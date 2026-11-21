import type { ReactNode } from "react";
import { t } from "../../i18n";
import { Icon } from "../../shared/ui/icon";
import { cn } from "../../shared/lib/utils";

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const primaryAction = cn(
  "inline-flex min-h-12 min-w-[16rem] cursor-pointer items-center justify-center gap-2 rounded-control border-0 bg-accent px-5 text-base font-semibold text-accent-ink shadow-lift transition-colors duration-(--duration-quick) hover:bg-accent-bright disabled:cursor-default disabled:opacity-55 max-sm:w-full max-sm:min-w-0",
  focusRing,
);
const iconTile = "grid size-16 place-items-center rounded-card border border-line-strong bg-accent/10 text-accent";

/** Before a session starts: the chosen situation, its description and the three steps. */
export function WelcomeCard({
  compact,
  icon,
  title,
  description,
  onChooseTopic,
  retry,
  error,
}: {
  compact: boolean;
  icon: string;
  title: string;
  description?: string;
  onChooseTopic?: () => void;
  retry?: () => void;
  error?: string;
}) {
  if (compact)
    return (
      <div className="android-training-start grid min-h-full place-items-center content-center gap-6 text-center">
        <span className={cn("topic__icon", iconTile)}>
          <Icon name={icon} size={26} />
        </span>
        <h1 className="m-0 font-display text-title-compact font-bold text-ink">{title}</h1>
        {onChooseTopic && (
          <button className={cn("android-primary", primaryAction)} type="button" onClick={onChooseTopic}>
            {t("shell.stage.chooseTopic")}
          </button>
        )}
        {error && (
          <p className="android-error m-0 text-sm text-danger" role="alert">
            {t(error)}
          </p>
        )}
      </div>
    );
  return (
    <div className="welcome-card grid min-h-[32rem] justify-items-center content-center gap-3 rounded-card border border-line bg-surface p-[clamp(2rem,5vw,4rem)] text-center text-ink max-sm:min-h-[26rem] max-sm:px-4">
      <span className={cn("welcome-card__icon mb-3", iconTile)}>
        <Icon name={icon} size={32} />
      </span>
      <p className="m-0 text-caption font-semibold uppercase tracking-widest text-accent">{t("shell.stage.selectedSituation")}</p>
      <h2 className="m-0 font-display text-title font-bold leading-tight">{title}</h2>
      {description && <p className="m-0 max-w-[34rem] text-base leading-relaxed text-ink-soft">{t(description)}</p>}
      {retry && (
        <button className={cn("answer-submit mt-3", primaryAction)} type="button" onClick={retry}>
          {t("shell.stage.retry")}
        </button>
      )}
      <ol className="welcome-card__steps m-0 mt-6 flex list-none flex-wrap justify-center gap-x-6 gap-y-3 p-0 text-sm text-ink-muted max-sm:grid max-sm:justify-start max-sm:text-left">
        {["shell.stage.steps.get", "shell.stage.steps.answer", "shell.stage.steps.review"].map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            <b className="grid size-6 place-items-center rounded-full border border-line-strong font-display text-sm text-accent">{index + 1}</b>
            {t(step)}
          </li>
        ))}
      </ol>
      {error && (
        <p className="error m-0 text-sm text-danger" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}

/** A finished session, or a topic with no phrases left. */
export function PracticeDone({ compact, title, summary, onRestart }: { compact: boolean; title: string; summary: string; onRestart: () => void }) {
  return (
    <div className={cn("practice-done grid min-h-[22rem] justify-items-center content-center gap-4 p-8 text-center text-ink", !compact && "rounded-card border border-line bg-surface")}>
      <h1 className="m-0 font-display text-title-compact font-bold">{t(title)}</h1>
      <p className="m-0 text-ink-soft">{t(summary)}</p>
      <button className={cn(compact ? "android-primary" : "answer-submit", primaryAction)} type="button" onClick={onRestart}>
        {t("shell.stage.chooseNewTopic")}
      </button>
    </div>
  );
}

/** The review list is empty: a congratulation and the way back to the topics. */
export function ReviewComplete({ compact, message, onHome }: { compact: boolean; message: ReactNode; onHome: () => void }) {
  return (
    <div className={cn("review-complete grid min-h-full place-items-center content-center gap-6 px-4 py-8 text-center", !compact && "min-h-[32rem]")}>
      <button
        className={cn("review-home grid size-18 cursor-pointer place-items-center rounded-card border border-line-strong bg-surface-raised p-0 text-accent hover:bg-selected", focusRing)}
        type="button"
        aria-label={t("shell.stage.chooseTopic")}
        onClick={onHome}
      >
        <Icon name="home" size={32} />
      </button>
      <p className="review-congratulations m-0 max-w-xl font-display text-title-compact leading-normal text-ink" role="status">
        {message}
      </p>
    </div>
  );
}
