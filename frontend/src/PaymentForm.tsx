import { useEffect, useRef, useState } from "react";
import { getLanguage, t } from "./i18n";
import { paymentRequest, type Country, type Payment, type PaymentOptions } from "./api/payments";
import { countryLabels, methodLabels, statusLabels } from "./paymentLabels";
import sbp from "./assets/payments/sbp.svg";
import paypal from "./assets/payments/paypal.svg";

const logos = { sbp, paypal };
const descriptions = { sbp: "payment.transferByPhoneNumber", paypal: "payment.payPaypal" };

function CopyValue({ label, value }: { label: string; value: string }) {
  const [message, setMessage] = useState("");
  return <div className="payment-value"><span>{t(label)}</span><strong>{value}</strong>
    <button type="button" aria-label={`${t("payment.copy")}: ${t(label)}`} onClick={() => {
      navigator.clipboard?.writeText(value).then(() => setMessage("payment.copied")).catch(() => setMessage("payment.copyFailedSelectCopy"));
      if (!navigator.clipboard) setMessage("payment.copyFailedSelectCopy");
    }}>{t("payment.copy")}</button><small role="status">{t(message)}</small></div>;
}

export function PaymentForm({ onClose, onGranted }: { onClose: () => void; onGranted?: () => Promise<void> }) {
  const [options, setOptions] = useState<PaymentOptions>();
  const [payment, setPayment] = useState<Payment>();
  const [country, setCountry] = useState<Country | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [paidAt, setPaidAt] = useState("");
  const [amount, setAmount] = useState("");
  const [transaction, setTransaction] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const locked = useRef(false);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      paymentRequest<PaymentOptions>("/payments/options", "GET", undefined, controller.signal),
      paymentRequest<Payment[]>("/payments", "GET", undefined, controller.signal),
    ]).then(([config, payments]) => {
      if (controller.signal.aborted) return;
      setOptions(config); setError(false);
      const current = payments[0];
      setPayment(current);
      setCountry(current?.country ?? "");
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [retry]);

  async function mutate(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(false);
    try { await action(); } catch { setError(true); }
    finally { locked.current = false; setBusy(false); }
  }
  const awaiting = payment?.status === "awaiting_payment";
  const reviewing = payment?.status === "awaiting_review";
  const canChoose = !reviewing && payment?.status !== "confirmed";
  const language = getLanguage();

  return <section className="payment-form panel" aria-labelledby="payment-title" aria-busy={busy}>
    <header><h2 id="payment-title" tabIndex={-1} ref={heading}>{t("payment.premiumLifetimeAccess")}</h2>
      <button type="button" disabled={busy} onClick={onClose}>{t("payment.close")}</button></header>
    <p>{t("payment.oneTimePayment5")}</p>
    <p>{t("payment.noSubscriptionAutomaticCharges")}</p>
    <p>{t("payment.premiumActivatesImmediatelyAfter")}</p>
    {options?.activation && <p>{options.activation[language]}</p>}
    {!options?.activation && options && <p role="status">{t("payment.activationTermsHaveNot")}</p>}
    {error && <div role="alert"><p>{t("payment.actionCouldNotCompleted")}</p>
      <button type="button" disabled={busy} onClick={() => setRetry(value => value + 1)}>{t("payment.refreshStatus")}</button></div>}
    {!options && !error && <p role="status">{t("payment.loadingPaymentMethods")}</p>}
    {options && <>
      <label>{t("payment.whichCountryYouPaying")}<select required value={country} disabled={busy || !canChoose} onChange={event => {
        const next = event.target.value as Country | "";
        void mutate(async () => {
          if (awaiting && payment) await paymentRequest(`/payments/${payment.id}/cancel`, "POST");
          setCountry(next); setPayment(undefined); setPaidAt(""); setAmount(""); setTransaction("");
        });
      }}><option value="">{t("payment.selectCountry")}</option>{Object.entries(countryLabels).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select></label>
      {country && canChoose && <div className="payment-methods">{options.countries[country].filter((method): method is "sbp" | "paypal" => method === "sbp" || method === "paypal").map(method => <div key={method}>
        <button type="button" className="payment-method" disabled={busy || !options.methods[method].available}
          aria-pressed={awaiting && payment?.method === method} onClick={() => void mutate(async () => {
            setPayment(await paymentRequest<Payment>("/payments", "POST", { country, method }));
            setPaidAt(""); setAmount(""); setTransaction("");
          })}><span className="payment-logo"><img src={logos[method]} alt="" /></span><strong>{t(methodLabels[method])}</strong><span>{t(descriptions[method])}</span></button>
        {!options.methods[method].available && <small>{t("payment.unavailablePaymentDetailsActivation")}</small>}
      </div>)}</div>}
      <p className="payment-note">{t("payment.russiaPayRublesBank")}</p>
    </>}
    {payment && <div className="payment-details" key={payment.id}>
      <p role="status"><strong>{t(statusLabels[payment.status])}</strong></p>
      <CopyValue label="payment.requestNumber" value={payment.id} />
      <p>{t(countryLabels[payment.country])} · {t(methodLabels[payment.method])}</p>
      {payment.method === "alta" && (awaiting || reviewing) && <p role="status">{t("payment.methodNoLongerAvailable")}</p>}
      {(awaiting || reviewing) && payment.method !== "alta" && <>
        <p>{payment.activation[language]}</p>
        <CopyValue label="payment.amountDue" value={`${payment.details.amount} ${payment.details.currency}`} />
        <CopyValue label="payment.recipient" value={payment.details.recipient} />
        {payment.details.phone && <CopyValue label="payment.recipientPhoneNumber" value={payment.details.phone} />}
        {payment.details.bank && <CopyValue label="payment.recipientBank" value={payment.details.bank} />}
        {payment.details.account && <CopyValue label="payment.accountNumber" value={payment.details.account} />}
        {payment.details.bank_details && <CopyValue label="payment.bankDetails" value={payment.details.bank_details} />}
        {(payment.details.paypal || payment.details.paypal_url) && <CopyValue label="payment.paypalRecipient" value={payment.details.paypal || payment.details.paypal_url!} />}
        <p className="payment-instructions">{payment.details.instructions[language]}</p>
        {payment.method === "paypal" && <><p>{t("payment.payPurchaseAsCommercial")}</p>
          <a href={payment.details.paypal_url || "https://www.paypal.com/"} target="_blank" rel="noopener noreferrer">{t("payment.openPaypal")}</a></>}
      </>}
      {awaiting && <form onSubmit={event => { event.preventDefault(); void mutate(async () => {
        const updated = await paymentRequest<Payment>(`/payments/${payment.id}/report`, "POST", {
          paid_at: new Date(paidAt).toISOString(), amount, transaction_id: transaction.trim() || null,
        });
        setPayment(updated);
        if (onGranted) await onGranted();
      }); }}>
        <label>{t("payment.paymentDateApproximateTime")}<input required type="datetime-local" value={paidAt} disabled={busy} onChange={event => setPaidAt(event.target.value)} /></label>
        <label>{t("payment.amountTransferred")} ({payment.details.currency})<input required type="number" min="0.01" max="9999999999.99" step="0.01" inputMode="decimal" value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} /></label>
        <label>{t("payment.transactionIdOptional")}<input maxLength={200} value={transaction} disabled={busy} onChange={event => setTransaction(event.target.value)} /></label>
        <button type="submit" disabled={busy}>{t(busy ? "payment.sending" : "payment.iHavePaid")}</button>
        <button type="button" disabled={busy} onClick={() => void mutate(async () => setPayment(await paymentRequest<Payment>(`/payments/${payment.id}/cancel`, "POST")))}>{t("payment.cancelRequest")}</button>
      </form>}
      {reviewing && <p role="status">{t("payment.administratorWillVerifyConfirm")}</p>}
      {(payment.status === "confirmed" || (reviewing && payment.provisional_granted_at)) && <p>{t("payment.premiumHasBeenActivated")}</p>}
      <button type="button" disabled={busy} onClick={() => { if (payment.status === "confirmed" || (reviewing && payment.provisional_granted_at)) window.location.reload(); else setRetry(value => value + 1); }}>{t("payment.refreshStatus")}</button>
    </div>}
  </section>;
}
