import { t } from "./i18n";
import { cn } from "./shared/lib/utils";
import { Component, lazy, Suspense, useState, type ComponentType, type ReactNode } from "react";

type PanelModule<Props> = { default: ComponentType<Props> };

// Loading and failure card for a lazily loaded section; full width inside a phone panel.
const panel = "deferred-panel mx-auto my-8 grid min-h-45 w-[min(1120px,calc(100%-2rem))] content-center justify-items-start gap-4 rounded-card border border-line bg-surface p-6 text-ink in-[.android-page]:m-0 in-[.android-page]:w-full";

class PanelErrorBoundary extends Component<{ children: ReactNode; onRetry: (error: unknown) => void }, { failed: boolean; error?: unknown }> {
  state: { failed: boolean; error?: unknown } = { failed: false };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, error };
  }

  render() {
    if (this.state.failed) {
      return <div className={panel} role="alert">
        <p className="m-0">{t("common.couldNotOpenSection")}</p>
        <button className={cn("cursor-pointer rounded-control border border-line bg-surface-raised px-4 py-2.5 font-semibold text-ink hover:border-line-strong", "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface")} type="button" onClick={() => this.props.onRetry(this.state.error)}>{t("premium.retryLoading")}</button>
      </div>;
    }
    return this.props.children;
  }
}

export function DeferredPanel<Props extends object>({ load, panelProps, label }: {
  load: (retryUrl?: string) => Promise<PanelModule<Props>>;
  panelProps: Props;
  label: string;
}) {
  const [Panel, setPanel] = useState(() => lazy(load));
  const [retry, setRetry] = useState(0);

  function retryLoad(error: unknown) {
    // A failed React.lazy instance retains its rejected promise. Make a new one for each retry.
    // Browsers also retain failed module URLs, so a network failure needs a fresh URL.
    const match = error instanceof Error ? error.message.match(/https?:\/\/[^\s)]+\.js(?:\?[^\s)]*)?/) : null;
    let retryUrl: string | undefined;
    if (match) {
      const url = new URL(match[0]);
      if (url.origin === window.location.origin && url.pathname.includes("/assets/")) {
        url.searchParams.set("panel-retry", String(retry + 1));
        retryUrl = url.href;
      }
    }
    setPanel(lazy(() => load(retryUrl)));
    setRetry((current) => current + 1);
  }

  return <PanelErrorBoundary key={retry} onRetry={retryLoad}>
    <Suspense fallback={<div className={panel} role="status" aria-live="polite">{t("common.loadingSection", { section: t(label) })}</div>}>
      <Panel {...panelProps} />
    </Suspense>
  </PanelErrorBoundary>;
}
