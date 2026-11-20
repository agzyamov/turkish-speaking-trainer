import { useId, type ReactNode } from "react";
import { SettingsIcon, type SettingsIconName } from "./SettingsIcon";
import { t, useLanguage, setLanguage, type InterfaceLanguage } from "./i18n";
import type { CurrentUser } from "./types/auth";
import { ModelDebugSettings } from "./ModelDebugSettings";
import { TranscriptionModelSettings } from "./TranscriptionModelSettings";
import { version } from "../package.json";
import { FeedbackSettings } from "./FeedbackSettings";
import { ShareAppSettings } from "./ShareAppSettings";
import { setRewardPreference, useRewardPreference } from "./rewardPreferences";
import { Button } from "./shared/ui/button";
import { Card, CardDescription, CardTitle } from "./shared/ui/card";
import { RadioGroup, RadioGroupItem } from "./shared/ui/radio-group";
import { Switch } from "./shared/ui/switch";

const groupClass = "m-0 grid min-w-0 gap-3 rounded-card border border-line bg-surface p-5 text-ink";
const legendClass = "px-1.5 font-bold text-ink";
const optionClass = "flex min-h-14 cursor-pointer items-center gap-3 rounded-control border border-line p-3 transition-colors hover:border-line-strong has-[[data-state=checked]]:border-line-strong has-[[data-state=checked]]:bg-selected";

function LanguageOption({ value, icon, label }: { value: InterfaceLanguage; icon: SettingsIconName; label: string }) {
  const id = useId();
  return <label htmlFor={id} data-slot="language-option" className={optionClass}>
    <SettingsIcon name={icon} />
    <strong className="flex-1">{label}</strong>
    <RadioGroupItem id={id} value={value} />
  </label>;
}

function SwitchRow({ icon, label, checked, disabled, onChange, children }: {
  icon: SettingsIconName; label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; children?: ReactNode;
}) {
  const id = useId();
  return <div className="flex items-start gap-3">
    <SettingsIcon name={icon} />
    <div className="grid min-w-0 flex-1 gap-2">
      <label htmlFor={id} data-slot="switch-row" className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <strong>{label}</strong>
        <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      </label>
      {children}
    </div>
  </div>;
}

export function SettingsView({ account, onSignOut, assistanceEnabled = false, assistanceSaving = false, assistanceError, onAssistanceChange }: {
  assistanceEnabled?: boolean;
  assistanceSaving?: boolean;
  assistanceError?: string;
  onAssistanceChange?: (enabled: boolean) => void;
  account?: CurrentUser;
  onSignOut?: () => void;
}) {
  const language = useLanguage();
  const sounds = useRewardPreference("sounds");
  const animations = useRewardPreference("animations");
  const languageLegendId = useId();
  const accountTitleId = useId();
  const deletionTitleId = useId();
  return <main className="settings-page mx-auto grid w-full max-w-settings gap-4 px-4 py-8 text-ink in-[.android-settings-page]:px-0 in-[.android-settings-page]:py-1 [&>.settings-admin-grid]:m-0 [&>.settings-section]:m-0">
    <header data-slot="settings-heading" className="flex items-center justify-between gap-4">
      <h1 className="m-0 text-title in-[.android-settings-page]:text-title-compact">{t("Настройки")}</h1>
      <span data-slot="settings-version" className="whitespace-nowrap text-caption text-ink-muted" aria-label={t("Версия приложения")}>v.{t(version.split(".").slice(0, 2).join("."))}</span>
    </header>

    <fieldset className={`language-settings ${groupClass}`}>
      <legend id={languageLegendId} className={legendClass}>{t("Язык интерфейса и исходных фраз")}</legend>
      <RadioGroup className="grid-cols-2" value={language} onValueChange={value => setLanguage(value as InterfaceLanguage)} aria-labelledby={languageLegendId}>
        <LanguageOption value="ru" icon="ru" label="Русский" />
        <LanguageOption value="en" icon="en" label="English" />
      </RadioGroup>
    </fieldset>

    <Card aria-label={t("Мягкие подсказки при распознавании")}>
      <SwitchRow icon="hints" label={t("Мягкие подсказки при распознавании")} checked={assistanceEnabled} disabled={assistanceSaving} onChange={checked => onAssistanceChange?.(checked)}>
        <p className="m-0 text-sm leading-normal text-ink-muted">{t("Сравнивать каждую расшифровку с эталоном и допустимыми переводами, предлагая близкие варианты возможных искажений распознавания. Все изменения применяются только после вашего подтверждения.")}</p>
        {assistanceSaving && <p className="m-0 text-ink-soft" role="status">{t("Сохраняем настройку…")}</p>}
        {assistanceError && <p className="m-0 text-danger" role="alert">{t(assistanceError)}</p>}
      </SwitchRow>
    </Card>

    <fieldset className={groupClass}>
      <legend className={legendClass}>{t("Награды за успехи")}</legend>
      <p className="m-0 text-caption text-ink-muted">{t("Звоночек за 100% и золотая награда за 20 повторений за день. Настройки сохраняются на этом устройстве.")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-control border border-line p-3"><SwitchRow icon="bell" label={t("Звуки успеха")} checked={sounds} onChange={checked => setRewardPreference("sounds", checked)} /></div>
        <div className="rounded-control border border-line p-3"><SwitchRow icon="celebrate" label={t("Анимации успеха")} checked={animations} onChange={checked => setRewardPreference("animations", checked)} /></div>
      </div>
    </fieldset>

    <ShareAppSettings />
    <FeedbackSettings />
    {account?.role === "admin" && account.can_debug_models && <div className="settings-admin-grid settings-card-grid"><TranscriptionModelSettings key={`transcription-${account.id}`} /><ModelDebugSettings key={account.id} /></div>}

    {account && <>
      <Card aria-labelledby={accountTitleId}>
        <CardTitle id={accountTitleId}>{t("Аккаунт")}</CardTitle>
        <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div data-slot="account-profile" className="flex min-w-0 items-center gap-3">
            <span className="avatar shrink-0">{account.display_name?.slice(0, 1).toLocaleUpperCase() || "A"}</span>
            <span className="grid min-w-0 gap-1 [overflow-wrap:anywhere]">
              <strong>{account.display_name || account.email}</strong>
              {account.display_name && <span className="text-caption text-ink-muted">{account.email}</span>}
              <small className="text-caption text-ink-muted">{t(account.daily_usage.limit === null ? `${account.daily_usage.used} фраз · без лимита` : `${account.daily_usage.remaining} из ${account.daily_usage.limit} фраз осталось`)}</small>
            </span>
          </div>
          <Button className="w-full sm:w-auto" onClick={onSignOut}>{t("Выйти")}</Button>
        </div>
      </Card>
      <Card aria-labelledby={deletionTitleId}>
        <CardTitle id={deletionTitleId}>{t("Удаление аккаунта")}</CardTitle>
        <CardDescription><a className="text-accent-bright underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-focus [overflow-wrap:anywhere]" href="/delete-account">{t("Запросить удаление аккаунта и данных")}</a></CardDescription>
      </Card>
    </>}
  </main>;
}
