param(
    [string]$SigningDirectory = (Join-Path $env:USERPROFILE '.android\turktalk-upload')
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$SigningDirectory = [System.IO.Path]::GetFullPath($SigningDirectory)
if ($SigningDirectory.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Private signing material must be stored outside the repository.'
}
if (!(Test-Path "$env:JAVA_HOME\bin\keytool.exe")) { throw 'Set JAVA_HOME to the JDK 21 directory.' }
$keyStore = Join-Path $SigningDirectory 'upload.p12'
$protectedPassword = Join-Path $SigningDirectory 'password.dpapi'
$keyAlias = 'turktalk-upload'

# The private key and Windows-user-protected password remain outside the repository.
if (!(Test-Path $keyStore)) {
    if (Test-Path $SigningDirectory) { throw 'Signing directory already exists; inspect it before creating a key.' }
    New-Item -ItemType Directory -Path $SigningDirectory | Out-Null
    $account = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $SigningDirectory /inheritance:r /grant:r "${account}:(OI)(CI)F" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not restrict signing directory access.' }
    $randomBytes = New-Object byte[] 48
    $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $randomGenerator.GetBytes($randomBytes) } finally { $randomGenerator.Dispose() }
    $password = [Convert]::ToBase64String($randomBytes)
    ConvertTo-SecureString $password -AsPlainText -Force | ConvertFrom-SecureString |
        Set-Content -LiteralPath $protectedPassword -Encoding ASCII
    $env:TURKTALK_UPLOAD_PASSWORD = $password
    try {
        & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -keystore $keyStore -storetype PKCS12 `
            -alias $keyAlias -keyalg RSA -keysize 3072 -validity 10000 `
            -dname 'CN=TurkTalk Upload, O=TurkTalk' -storepass:env TURKTALK_UPLOAD_PASSWORD
        if ($LASTEXITCODE -ne 0) { throw 'Upload key generation failed.' }
    } finally { Remove-Item Env:TURKTALK_UPLOAD_PASSWORD; $password = $null }
}
if (!(Test-Path $protectedPassword)) { throw 'Windows-protected signing password is missing.' }
$securePassword = Get-Content -LiteralPath $protectedPassword | ConvertTo-SecureString
$credential = New-Object System.Management.Automation.PSCredential($keyAlias, $securePassword)
$env:TURKTALK_UPLOAD_PASSWORD = $credential.GetNetworkCredential().Password
try {
    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        & pnpm android:sync
        if ($LASTEXITCODE -ne 0) { throw 'Production Android assets build/sync failed.' }
        # The web build must not contain the iOS simulator test build's fake microphone (ADR-0014).
        & node build/checkNoTestAudio.mjs dist
        if ($LASTEXITCODE -ne 0) { throw 'The web build contains iOS simulator test-build code.' }
        Push-Location android
        try {
            & .\gradlew.bat bundleProdRelease
            if ($LASTEXITCODE -ne 0) { throw 'Production release bundle build failed.' }
        } finally { Pop-Location }
    } finally { Pop-Location }
    $version = (Get-Content (Join-Path $projectRoot 'frontend\android\app\build.gradle') -Raw |
        Select-String 'versionName "([^"]+)"').Matches[0].Groups[1].Value
    $artifactDirectory = Join-Path $projectRoot 'artifacts'
    New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
    $bundle = Join-Path $artifactDirectory "TurkTalk-android-$version.aab"
    Copy-Item -LiteralPath (Join-Path $projectRoot 'frontend\android\app\build\outputs\bundle\prodRelease\app-prod-release.aab') -Destination $bundle
    & "$env:JAVA_HOME\bin\jarsigner.exe" -keystore $keyStore -storetype PKCS12 `
        -storepass:env TURKTALK_UPLOAD_PASSWORD -digestalg SHA-256 -sigalg SHA256withRSA $bundle $keyAlias
    if ($LASTEXITCODE -ne 0) { throw 'Bundle signing failed.' }
    & "$env:JAVA_HOME\bin\jarsigner.exe" -verify $bundle
    if ($LASTEXITCODE -ne 0) { throw 'Bundle signature verification failed.' }
    Write-Output "Signed bundle: $bundle"
    Get-FileHash -LiteralPath $bundle -Algorithm SHA256
} finally {
    Remove-Item Env:TURKTALK_UPLOAD_PASSWORD
    $credential = $null
    $securePassword = $null
}
