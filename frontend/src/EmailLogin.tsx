import { useEffect, useRef, useState } from "react";
import { isEmailOtpEnabled, requestEmailCode, verifyEmailCode } from "./emailAuth";
import { t, useLanguage } from "./i18n";
import { cn } from "./shared/lib/utils";
import { Button } from "./shared/ui/button";
import { Input } from "./shared/ui/input";
import { authDetails } from "./features/auth/authStyles";

export function EmailLogin({ onSignedIn }: { onSignedIn?: () => void } = {}) {
  useLanguage();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string>();
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!retryAt) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [retryAt]);

  if (!isEmailOtpEnabled()) return null;

  async function sendCode() {
    if (pending.current || Date.now() < retryAt) return;
    pending.current = true; setBusy(true); setError(undefined);
    // Also pace failed requests: retries must never send a burst of emails.
    setRetryAt(Date.now() + 60_000); setRemaining(60);
    try { await requestEmailCode(email); setSent(true); setCode(""); }
    catch { setError("Не удалось отправить код. Проверьте email и попробуйте позже."); }
    finally { pending.current = false; setBusy(false); }
  }

  async function verify() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(undefined);
    try { await verifyEmailCode(email, code); setCode(""); onSignedIn?.(); }
    catch { setCode(""); setError("Код недействителен или истёк. Попробуйте ещё раз или запросите новый."); }
    finally { pending.current = false; setBusy(false); }
  }

  return <details className={cn("email-login", authDetails)}>
    <summary>{t("Войти по email")}</summary>
    <form aria-label={t("Вход по коду из письма")} onSubmit={event => { event.preventDefault(); void (sent ? verify() : sendCode()); }}>
      <p>{t("Отправим одноразовый код на вашу почту. Пароль не нужен.")}</p>
      <label>{t("Email")}<Input type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} disabled={busy || sent} onChange={event => setEmail(event.target.value)} /></label>
      {sent && <>
        <p role="status">{t("Код отправлен. Проверьте входящие и папку «Спам».")}</p>
        <label>{t("Код из письма")}<Input type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6,10}" maxLength={10} value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} /></label>
      </>}
      <Button variant="primary" type="submit" disabled={busy || (!sent && remaining > 0)}>{t(busy ? sent ? "Входим…" : "Отправляем код…" : sent ? "Войти" : "Получить код")}</Button>
      {remaining > 0 && <p>{t(`Повторная отправка через ${remaining} с.`)}</p>}
      {sent && <>
        <Button disabled={busy || remaining > 0} onClick={() => void sendCode()}>{t("Отправить код ещё раз")}</Button>
        <Button disabled={busy} onClick={() => { setSent(false); setCode(""); setError(undefined); }}>{t("Изменить email")}</Button>
      </>}
      {error && <p role="alert">{t(error)}</p>}
    </form>
  </details>;
}
