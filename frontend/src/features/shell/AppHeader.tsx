import type { ReactNode } from "react";
import { t } from "../../i18n";
import { Icon } from "../../shared/ui/icon";
import { PremiumBadge } from "../../PremiumBadge";
import { cn } from "../../shared/lib/utils";

export type AppView = "practice" | "statistics" | "premium" | "settings" | "admin";
export type BackendState = "checking" | "online" | "offline";

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

/** The product name; the brand moves to one configuration in Phase 5. */
export function Wordmark({ className }: { className?: string }) {
  return <strong className={cn("font-display font-bold tracking-tight text-ink", className)}>Serbo<span className="text-accent">Talk</span></strong>;
}

function NavButton({ active, premium, premiumActive, label, onClick, children }: {
  active: boolean; premium?: boolean; premiumActive?: boolean; label?: string; onClick: () => void; children: ReactNode;
}) {
  return <button type="button" aria-label={label} aria-current={active ? "page" : undefined} onClick={onClick}
    className={cn("relative grid min-w-22 cursor-pointer place-items-center content-center gap-1 border-0 bg-transparent px-2 py-2.5 text-xs font-medium text-ink-muted transition-colors duration-(--duration-quick) hover:text-ink",
      "after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:content-['']", focusRing,
      active && "is-active text-ink after:bg-accent [&_.icon]:text-accent",
      premium && "premium-nav [&_.premium-badge]:size-5 [&_.premium-badge]:text-current",
      // An owned Premium shows a muted gold crown, full gold when its page is open.
      premium && premiumActive && "premium-nav--active [&_.premium-badge]:text-reward/70",
      premium && premiumActive && active && "after:bg-reward [&_.premium-badge]:text-reward")}>{children}</button>;
}

/** Desktop header: product mark, the five sections, and the service connection state. */
export function AppHeader({ view, premiumActive, showAdmin, backendState, onHome, onShow, onRetry }: {
  view: AppView; premiumActive: boolean; showAdmin: boolean; backendState: BackendState;
  onHome: () => void; onShow: (view: AppView) => void; onRetry: () => void;
}) {
  return <header className="topbar relative z-5 grid min-h-16 grid-cols-[minmax(14rem,1fr)_auto_minmax(14rem,1fr)] items-stretch border-b border-line bg-surface px-[clamp(1rem,2.6vw,3rem)] pt-[env(safe-area-inset-top)]">
    <button className={cn("brand flex w-max cursor-pointer items-center gap-3 self-center rounded-control border-0 bg-transparent p-0 text-left", focusRing)} type="button" onClick={onHome} aria-label={t("shell.homeLabel")}>
      <span className="grid size-10 place-items-center rounded-control border border-line-strong text-accent"><Icon name="message" size={24} /></span>
      <span className="grid">
        <Wordmark className="text-2xl leading-none" />
        <small className="mt-1 text-xs text-ink-muted">{t("shell.tagline")}</small>
      </span>
    </button>
    <nav className="main-nav flex items-stretch gap-4" aria-label={t("shell.mainNavigation")}>
      <NavButton active={view === "practice"} onClick={() => onShow("practice")}><Icon name="home" />{t("shell.nav.practice")}</NavButton>
      <NavButton active={view === "statistics"} onClick={() => onShow("statistics")}><Icon name="chart" />{t("shell.nav.statistics")}</NavButton>
      <NavButton active={view === "premium"} premium premiumActive={premiumActive} label={t("shell.nav.premium")} onClick={() => onShow("premium")}><PremiumBadge />{t("shell.nav.premium")}</NavButton>
      <NavButton active={view === "settings"} onClick={() => onShow("settings")}><Icon name="settings" />{t("shell.nav.settings")}</NavButton>
      {showAdmin && <NavButton active={view === "admin"} onClick={() => onShow("admin")}><Icon name="settings" />{t("shell.nav.users")}</NavButton>}
    </nav>
    <div className="profile flex items-center justify-self-end gap-3">
      <div className={`connection connection--${backendState} grid size-5 place-items-center`} role="status"
        aria-label={t(backendState === "online" ? "shell.backend.online" : backendState === "offline" ? "shell.backend.offline" : "shell.backend.checking")}>
        <span className={cn("size-2 rounded-full", backendState === "online" ? "bg-success" : backendState === "offline" ? "bg-danger" : "bg-reward")} />
      </div>
      {backendState === "offline" && <button className={cn("connection-settings-button grid size-9 cursor-pointer place-items-center rounded-control border border-line bg-surface-raised p-0 text-ink-soft hover:border-line-strong hover:text-ink", focusRing)}
        type="button" aria-label={t("shell.backend.retryTopics")} onClick={onRetry}><Icon name="repeat" /></button>}
    </div>
  </header>;
}

/** Phone header: product mark and the five panels as icon buttons. */
export function MobileHeader({ panel, premiumActive, webShell, onShow }: {
  panel: number; premiumActive: boolean; webShell: boolean; onShow: (panel: number) => void;
}) {
  const item = (index: number, label: string, icon: ReactNode, extra?: string) => <button type="button" aria-label={t(label)}
    aria-current={panel === index ? "page" : undefined} onClick={() => onShow(index)}
    className={cn("grid h-10.5 w-10.5 cursor-pointer place-items-center rounded-control border-0 bg-transparent p-0 text-ink-muted transition-colors duration-(--duration-quick) max-[360px]:w-9.5",
      webShell && "size-11", panel === index && "bg-selected text-accent", focusRing, extra)}>{icon}</button>;
  return <header className={cn("android-header relative z-5 flex items-center justify-between border-b border-line bg-surface max-[360px]:pl-2 max-[360px]:pr-1",
    webShell ? "h-phone-header pl-4 pr-2" : "h-[calc(var(--spacing-phone-header)+env(safe-area-inset-top))] px-4 pt-[env(safe-area-inset-top)]")}>
    <Wordmark className="text-lg" />
    <nav className={cn("flex", webShell ? "gap-0" : "gap-1 max-[360px]:gap-0")} aria-label={t("shell.appPanels")}>
      {item(0, "shell.nav.topics", <Icon name="home" />)}
      {item(1, "shell.nav.training", <Icon name="mic" />)}
      {item(2, "shell.nav.statistics", <Icon name="chart" />)}
      {item(3, "shell.nav.premium", <PremiumBadge />, cn("premium-nav [&_.premium-badge]:text-current", premiumActive && "premium-nav--active text-reward/70", premiumActive && panel === 3 && "text-reward"))}
      {item(4, "shell.nav.settings", <Icon name="settings" />)}
    </nav>
  </header>;
}
