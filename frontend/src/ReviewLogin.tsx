import { t } from "./i18n";
import { useState } from "react";
import { signInReviewAccount } from "./auth";
import { cn } from "./shared/lib/utils";
import { Button } from "./shared/ui/button";
import { Input } from "./shared/ui/input";
import { authDetails } from "./features/auth/authStyles";

export function ReviewLogin({ onSignedIn }: { onSignedIn?: () => void } = {}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <details className={cn("review-login", authDetails)}>
    <summary>{t("auth.reviewAccess")}</summary>
    <form onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      setBusy(true); setError(false);
      try { await signInReviewAccount(email.trim(), password); setPassword(""); onSignedIn?.(); }
      catch { setPassword(""); setError(true); }
      finally { setBusy(false); }
    }}>
      <p>{t("auth.useDedicatedReviewAccount")}</p>
      <label>{t("auth.usernameEmail")}<Input type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="serbotalkreview" value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
      <label>{t("auth.password")}<Input type="password" required autoComplete="current-password" value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
      <Button variant="primary" type="submit" disabled={busy}>{t(busy ? "auth.signing" : "auth.sign")}</Button>
      {error && <p role="alert">{t("auth.signFailedCheckCredentials")}</p>}
    </form>
  </details>;
}
