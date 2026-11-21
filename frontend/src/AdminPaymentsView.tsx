import { useEffect, useRef, useState } from "react";
import { getLocale, t } from "./i18n";
import { paymentRequest, type AdminPayment, type Payment } from "./api/payments";
import { countryLabels, methodLabels, statusLabels } from "./paymentLabels";
import { Button } from "./shared/ui/button";

export function AdminPaymentsView() {
  const [payments, setPayments] = useState<AdminPayment[]>();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [confirm, setConfirm] = useState<string>();
  const locked = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    paymentRequest<AdminPayment[]>(`/admin/payments?offset=${offset}`, "GET", undefined, controller.signal)
      .then(rows => { if (!controller.signal.aborted) { setPayments(rows); setError(false); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [offset, refresh]);
  async function decide(id: string, status: "confirmed" | "rejected" | "cancelled") {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(false);
    try {
      const updated = await paymentRequest<Payment>(`/admin/payments/${id}`, "PATCH", { status });
      setPayments(rows => rows?.map(row => row.id === id ? { ...row, ...updated } : row)); setConfirm(undefined);
    } catch { setError(true); }
    finally { locked.current = false; setBusy(false); }
  }
  return <section className="admin-payments grid min-w-0 gap-3 rounded-card border border-line bg-surface p-5 text-ink max-[640px]:p-3 [&_p]:m-0 [&_p]:text-sm [&_p]:text-ink-soft [&_p]:[overflow-wrap:anywhere] [&_[role=alert]]:text-danger!" aria-busy={busy}>
    <h2 className="m-0 font-display text-xl font-bold">{t("Заявки на оплату Premium")}</h2>
    <Button className="justify-self-start" disabled={busy} onClick={() => setRefresh(value => value + 1)}>{t("Обновить статус")}</Button>
    {error && <p role="alert">{t("Не удалось выполнить действие. Обновите статус заявки перед повторной попыткой.")}</p>}
    {!payments && !error && <p>{t("Загружаем заявки…")}</p>}
    {payments?.length === 0 && <p>{t("Заявок пока нет.")}</p>}
    {payments?.map(payment => <article className="payment-admin-request grid gap-1.5 border-t border-line pt-4" key={payment.id}>
      <h3 className="m-0 text-base font-semibold [overflow-wrap:anywhere]">{payment.email}</h3><p>{payment.display_name} · {payment.user_id}</p>
      <p>{t("Номер заявки")}: {payment.id}</p>
      <p>{t(countryLabels[payment.country])} · {t(methodLabels[payment.method])} · <strong>{t(statusLabels[payment.status])}</strong></p>
      <p>{t("Сумма к оплате")}: {payment.details.amount} {payment.details.currency}</p>
      {payment.status === "awaiting_review" && payment.provisional_granted_at && <p>{t("Premium включён автоматически. Заявка ожидает проверки, доступ может быть отозван.")}</p>}
      {payment.paid_at && <><p>{t("Дата оплаты")}: {new Date(payment.paid_at).toLocaleString(getLocale())}</p>
        <p>{t("Переведённая сумма")}: {payment.reported_amount} {payment.details.currency}</p><p>{t("Идентификатор операции")}: {payment.transaction_id || "—"}</p></>}
      {payment.reviewed_by && <p>{t("Проверил")}: {payment.reviewed_by} · {payment.reviewed_at && new Date(payment.reviewed_at).toLocaleString(getLocale())}</p>}
      {payment.status === "awaiting_review" && <>
        {confirm === payment.id ? <><p>{t("Подтвердите фактическое поступление денег. Это включит бессрочный Premium.")}</p>
          <Button variant="primary" className="justify-self-start" disabled={busy} onClick={() => void decide(payment.id, "confirmed")}>{t("Деньги получены — включить Premium")}</Button>
          <Button className="justify-self-start" disabled={busy} onClick={() => setConfirm(undefined)}>{t("Назад")}</Button></>
          : <Button className="justify-self-start" disabled={busy} onClick={() => setConfirm(payment.id)}>{t("Подтвердить оплату")}</Button>}
        <Button variant="danger" className="justify-self-start" disabled={busy} onClick={() => void decide(payment.id, "rejected")}>{t(payment.provisional_granted_at ? "Отклонить и отозвать доступ" : "Отклонить заявку")}</Button>
      </>}
      {(payment.status === "awaiting_payment" || payment.status === "awaiting_review") && <Button variant="danger" className="justify-self-start" disabled={busy} onClick={() => void decide(payment.id, "cancelled")}>{t(payment.provisional_granted_at ? "Отменить и отозвать доступ" : "Отменить заявку")}</Button>}
    </article>)}
    <nav className="flex flex-wrap gap-2" aria-label={t("Страницы заявок")}><Button disabled={busy || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>{t("Назад")}</Button>
      <Button disabled={busy || payments?.length !== 50} onClick={() => setOffset(value => value + 50)}>{t("Далее")}</Button></nav>
  </section>;
}
