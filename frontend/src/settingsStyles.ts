// Shared classes for the Settings sections that live outside SettingsView (share, feedback, admin tools).
export const settingsSection =
  "settings-section grid min-w-0 gap-3 text-ink [&>p]:m-0 [&>p]:text-sm [&>p]:leading-normal [&>p]:text-ink-muted [&_[role=alert]]:text-danger! [&_[role=status]]:text-ink-soft!";
export const settingsHeading = "m-0 text-base font-bold text-ink";
export const settingsCard = "settings-card relative flex min-w-0 items-start gap-3 rounded-card border border-line bg-surface p-4 text-left text-ink max-[640px]:p-3.5";
export const settingsAction =
  "settings-action min-h-22 w-full cursor-pointer items-center font-semibold transition-colors duration-(--duration-quick) hover:border-line-strong disabled:cursor-wait disabled:text-ink-muted disabled:opacity-60 disabled:hover:border-line outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";
export const settingsCopy = "settings-card__copy grid min-w-0 flex-1 gap-2 [&>p]:m-0 [&>p]:text-sm [&>p]:leading-normal [&>p]:text-ink-muted [&>small]:text-caption [&>small]:text-ink-muted";
