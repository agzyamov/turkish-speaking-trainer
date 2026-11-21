import { useState } from "react";
import { CustomContentForm } from "./CustomContentForm";
import { CustomContentManager } from "./CustomContentManager";
import { t } from "./i18n";
import type { TopicListItem } from "./types/training";
import { PremiumBadge } from "./PremiumBadge";
import twoCoffees from "./assets/premium/two-coffees.webp";
import { PaymentForm } from "./PaymentForm";
import { Capacitor } from "@capacitor/core";
import { Button } from "./shared/ui/button";
import { cn } from "./shared/lib/utils";

export function PremiumView({ active, topics, onTopicCreated, onChanged, onDeleted, onPaymentReported }: {
  active: boolean; topics: TopicListItem[];
  onTopicCreated: (topic: TopicListItem) => void; onChanged: () => void;
  onDeleted: (topicId?: string) => void;
  onPaymentReported?: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"topic" | "phrase">();
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentReported, setPaymentReported] = useState(false);
  const perk = "relative pl-6 [overflow-wrap:anywhere] before:absolute before:left-0 before:text-reward before:content-['✓']";
  return <section className="premium-page mx-auto grid w-full max-w-[680px] gap-4 p-5 text-ink in-[.android-page]:p-0" aria-label={t("Премиум")}>
    {!active ? Capacitor.getPlatform() === "android" ? <p className="m-0 text-ink-soft" role="status">{t("Восстанавливаем доступ Premium…")}</p> : <div className="premium-offer flex flex-col items-center rounded-card border border-line bg-surface p-[clamp(1.25rem,4vw,2.5rem)] text-center">
      <header className="premium-offer__hero mb-6 grid justify-items-center gap-3 [&_.premium-badge]:size-22 [&_.premium-badge]:text-reward"><PremiumBadge /><h1 className="m-0 font-display text-title font-bold text-reward">{t("Премиум")}</h1></header>
      <ul className="m-0 mb-7 grid w-fit max-w-full list-none gap-3 p-0 text-left leading-relaxed">
        <li className={perk}>{t("100 повторений в день")}</li>
        <li className={perk}>{t("До 5 личных тем")}</li>
        <li className={perk}>{t("До 30 фраз в каждой теме — 150 своих фраз всего")}</li>
      </ul>
      <Button variant="primary" className="w-max max-w-full px-8 tracking-wide" onClick={() => setPaymentOpen(true)} aria-expanded={paymentOpen}>{t("КУПИТЬ")}</Button>
      {paymentOpen && <PaymentForm onGranted={async () => { setPaymentReported(true); await onPaymentReported?.(); }} onClose={() => { setPaymentOpen(false); document.querySelector<HTMLButtonElement>(".premium-offer > button")?.focus(); }} />}
      <p className="mb-1 mt-4 text-ink">{t("Однократный платёж 5 евро")}</p>
      <img className="mx-auto mb-5 mt-1 block h-auto w-[min(260px,100%)]" src={twoCoffees} alt={t("Две чашки кофе")} width="768" height="512" />
      <footer className="max-w-[380px] text-caption leading-normal text-ink-muted"><h2 className="m-0 mb-1 text-[length:inherit] font-semibold text-ink-muted">{t("Почему платно?")}</h2><p className="m-0">{t("Приложение использует платные API внешних моделей ИИ.")}</p></footer>
    </div> : <>
      <h1 className="m-0 font-display text-title-compact font-bold text-reward">{t("ПРЕМИУМ")}</h1>
      {paymentReported && <p className="m-0 text-ink-soft" role="status">{t("Администратор проверит и подтвердит ваш платёж, а пока вы можете пользоваться всеми Premium-функциями без ограничений.")}</p>}
      <div className="grid max-w-[440px] grid-cols-2 gap-3">
        {(["topic", "phrase"] as const).map(kind => <Button key={kind} aria-pressed={mode === kind} onClick={() => setMode(kind)}
          className={cn("min-h-20 justify-start bg-surface-raised text-left", mode === kind && "border-accent bg-selected text-accent-bright")}>{t(kind === "topic" ? "Создать тему" : "Создать фразу")}</Button>)}
      </div>
      {mode && <CustomContentForm key={mode} mode={mode} topics={topics} onClose={() => setMode(undefined)} onCreateTopic={() => setMode("topic")}
        onTopicCreated={onTopicCreated} onPhraseSaved={() => { onChanged(); setCatalogVersion(value => value + 1); }} />}
      <CustomContentManager key={catalogVersion} browseTopics topics={topics} onClose={() => undefined} onDeleted={onDeleted} />
    </>}
  </section>;
}
