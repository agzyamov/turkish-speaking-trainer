import { useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CustomContentForm } from "./CustomContentForm";
import { CustomContentManager } from "./CustomContentManager";
import { t } from "./i18n";
import type { TopicListItem } from "./types/training";
import { PremiumBadge } from "./PremiumBadge";
import twoCoffees from "./assets/premium/two-coffees.webp";
import { PaymentForm } from "./PaymentForm";
import { paymentRequest, type PaymentOptions } from "./api/payments";
import { Capacitor } from "@capacitor/core";
import { Button } from "./shared/ui/button";
import { cn } from "./shared/lib/utils";

/** What the Premium panel has open. Owned by the app so it survives the layout switching between phone and desktop. */
export type PremiumUiState = { mode?: "topic" | "phrase"; paymentOpen: boolean; paymentReported: boolean };

export function PremiumView({
  active,
  topics,
  onTopicCreated,
  onChanged,
  onDeleted,
  onPaymentReported,
  ui,
}: {
  active: boolean;
  topics: TopicListItem[];
  onTopicCreated: (topic: TopicListItem) => void;
  onChanged: () => void;
  onDeleted: (topicId?: string) => void;
  onPaymentReported?: () => Promise<void>;
  ui?: [PremiumUiState, Dispatch<SetStateAction<PremiumUiState>>];
}) {
  const local = useState<PremiumUiState>({ paymentOpen: false, paymentReported: false });
  const [{ mode, paymentOpen, paymentReported }, setUi] = ui ?? local;
  const setMode = (next?: "topic" | "phrase") => setUi(state => ({ ...state, mode: next }));
  const setPaymentOpen = (open: boolean) => setUi(state => ({ ...state, paymentOpen: open }));
  const setPaymentReported = (reported: boolean) => setUi(state => ({ ...state, paymentReported: reported }));
  const [catalogVersion, setCatalogVersion] = useState(0);
  const queryClient = useQueryClient();
  const offerShown = !active && Capacitor.getPlatform() !== "android";
  // With no payment details configured on the backend (MANUAL_PAYMENTS empty) nothing can be bought: say so
  // instead of offering a form whose every method is disabled. While loading or on error, keep the button.
  const paymentOptions = useQuery({
    queryKey: ["payment-options"],
    queryFn: ({ signal }) => paymentRequest<PaymentOptions>("/payments/options", "GET", undefined, signal),
    enabled: offerShown,
  });
  const onSale = !paymentOptions.data?.methods || Object.values(paymentOptions.data.methods).some(method => method?.available);
  const perk = "relative pl-6 [overflow-wrap:anywhere] before:absolute before:left-0 before:text-reward before:content-['✓']";
  return (
    <section className="premium-page mx-auto grid w-full max-w-[680px] gap-4 p-5 text-ink in-[.android-page]:p-0" aria-label={t("premium.title")}>
      {!active ? (
        Capacitor.getPlatform() === "android" ? (
          <p className="m-0 text-ink-soft" role="status">
            {t("premium.restoringPremiumAccess")}
          </p>
        ) : (
          <div className="premium-offer flex flex-col items-center rounded-card border border-line bg-surface p-[clamp(1.25rem,4vw,2.5rem)] text-center">
            <header className="premium-offer__hero mb-6 grid justify-items-center gap-3 [&_.premium-badge]:size-22 [&_.premium-badge]:text-reward">
              <PremiumBadge />
              <h1 className="m-0 font-display text-title font-bold text-reward">{t("premium.title")}</h1>
            </header>
            <ul className="m-0 mb-7 grid w-fit max-w-full list-none gap-3 p-0 text-left leading-relaxed">
              <li className={perk}>{t("premium.perks.repetitions")}</li>
              <li className={perk}>{t("premium.perks.topics")}</li>
              <li className={perk}>{t("premium.perks.phrases")}</li>
            </ul>
            {onSale ? (
              <Button variant="primary" className="w-max max-w-full px-8 tracking-wide" onClick={() => setPaymentOpen(true)} aria-expanded={paymentOpen}>
                {t("premium.buy")}
              </Button>
            ) : (
              <p className="m-0 font-semibold text-ink-soft" role="status">
                {t("premium.notOnSale")}
              </p>
            )}
            {onSale && paymentOpen && (
              <PaymentForm
                onGranted={async () => {
                  setPaymentReported(true);
                  await onPaymentReported?.();
                }}
                onClose={() => {
                  setPaymentOpen(false);
                  document.querySelector<HTMLButtonElement>(".premium-offer > button")?.focus();
                }}
              />
            )}
            {onSale && <p className="mb-1 mt-4 text-ink">{t("premium.oneTimePayment5")}</p>}
            <img className="mx-auto mb-5 mt-1 block h-auto w-[min(260px,100%)]" src={twoCoffees} alt={t("premium.twoCupsCoffee")} width="768" height="512" />
            <footer className="max-w-[380px] text-caption leading-normal text-ink-muted">
              <h2 className="m-0 mb-1 text-[length:inherit] font-semibold text-ink-muted">{t("premium.whyPaid")}</h2>
              <p className="m-0">{t("premium.appReliesPaidExternal")}</p>
            </footer>
          </div>
        )
      ) : (
        <>
          <h1 className="m-0 font-display text-title-compact font-bold text-reward">{t("premium.activeTitle")}</h1>
          {paymentReported && (
            <p className="m-0 text-ink-soft" role="status">
              {t("premium.administratorWillVerifyConfirm")}
            </p>
          )}
          <div className="grid max-w-[440px] grid-cols-2 gap-3">
            {(["topic", "phrase"] as const).map(kind => (
              <Button
                key={kind}
                aria-pressed={mode === kind}
                onClick={() => setMode(kind)}
                className={cn("min-h-20 justify-start bg-surface-raised text-left", mode === kind && "border-accent bg-selected text-accent")}
              >
                {t(kind === "topic" ? "premium.createTopic" : "premium.createPhrase")}
              </Button>
            ))}
          </div>
          {mode && (
            <CustomContentForm
              key={mode}
              mode={mode}
              topics={topics}
              onClose={() => setMode(undefined)}
              onCreateTopic={() => setMode("topic")}
              onTopicCreated={onTopicCreated}
              onPhraseSaved={() => {
                onChanged();
                // Drop the cached list so the remounted manager shows loading, not the list from before the save.
                void queryClient.resetQueries({ queryKey: ["customPhrases"] });
                setCatalogVersion(value => value + 1);
              }}
            />
          )}
          <CustomContentManager key={catalogVersion} browseTopics topics={topics} onClose={() => undefined} onDeleted={onDeleted} />
        </>
      )}
    </section>
  );
}
