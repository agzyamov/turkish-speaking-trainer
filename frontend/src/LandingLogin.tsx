import { useEffect, useState } from "react";
import { initializeAuth, isAuthConfigured, onAuthStateChange, signInWithGoogle } from "./auth";
import { EmailLogin } from "./EmailLogin";
import { ReviewLogin } from "./ReviewLogin";
import { t } from "./i18n";
import { authLegal, googleButton } from "./features/auth/authStyles";
import { brand } from "./shared/brand";

export function LandingLogin() {
  const [status, setStatus] = useState<"loading" | "signed-out" | "signed-in">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    initializeAuth()
      .then(session => {
        if (active) setStatus(session ? "signed-in" : "signed-out");
      })
      .catch(() => {
        if (active) {
          setStatus("signed-out");
          setError("auth.couldNotRestoreSession");
        }
      });
    const unsubscribe = onAuthStateChange(session => {
      if (active) setStatus(session ? "signed-in" : "signed-out");
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function login() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await signInWithGoogle("/app");
    } catch {
      setError("auth.couldNotOpenGoogle");
      setBusy(false);
    }
  }

  return (
    <section id="sign-in" className="landing-login" aria-labelledby="landing-login-title">
      <h3 id="landing-login-title">{t("auth.welcome", { app: brand.name })}</h3>
      <p>{t("auth.signRegisterSaveProgress")}</p>
      {status === "loading" ? (
        <p role="status">{t("auth.signingLoading")}</p>
      ) : status === "signed-in" ? (
        <a className="landing-cta" href="/app">
          {t("auth.continuePractising")} <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <>
          <button className={googleButton} type="button" disabled={busy || !isAuthConfigured()} onClick={() => void login()}>
            {t(busy ? "auth.openingGoogle" : "auth.signGoogle")}
          </button>
          {isAuthConfigured() && (
            <>
              <EmailLogin onSignedIn={() => window.location.assign("/app")} />
              <ReviewLogin onSignedIn={() => window.location.assign("/app")} />
            </>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {!isAuthConfigured() && <p role="alert">{t("auth.signTemporarilyUnavailablePlease")}</p>}
      <nav className={authLegal} aria-label={t("auth.legalInformation")}>
        <a href="/privacy">{t("auth.privacy")}</a>
        <a href="/terms">{t("auth.terms")}</a>
        <a href="/delete-account">{t("auth.accountDeletion")}</a>
      </nav>
    </section>
  );
}
