import { SettingsIcon } from "./SettingsIcon";
import { t } from "./i18n";
import { useEffect, useId, useRef, useState } from "react";
import { fetchModelDebug, updateModelDebug } from "./api/users";
import { cn } from "./shared/lib/utils";
import { Button } from "./shared/ui/button";
import { Switch } from "./shared/ui/switch";
import { settingsCard, settingsCopy } from "./settingsStyles";

export function ModelDebugSettings() {
  const switchId = useId();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    void fetchModelDebug(controller.signal).then(result => {
      if (!controller.signal.aborted) { setEnabled(result.enabled); setLoaded(true); }
    }).catch(() => {
      if (pending.current === controller) setError("Не удалось загрузить режим отладки. Откройте настройки повторно.");
    }).finally(() => {
      window.clearTimeout(timeout);
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    });
    return () => { pending.current?.abort(); pending.current = null; window.clearTimeout(timeout); };
  }, [reload]);

  async function change(value: boolean) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(undefined);
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const result = await updateModelDebug(value, controller.signal);
      if (pending.current === controller) setEnabled(result.enabled);
    } catch {
      if (pending.current === controller) setError("Не удалось изменить режим отладки. Проверьте подключение и повторите.");
    } finally {
      window.clearTimeout(timeout);
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }

  return <section className={cn("assistance-settings settings-section", settingsCard, "[&_[role=alert]]:text-danger [&_[role=status]]:text-ink-soft")} aria-label={t("Режим отладки")}>
    <SettingsIcon name="debug" />
    <div className={settingsCopy}>
    <label htmlFor={switchId} className="settings-toggle flex min-h-11 cursor-pointer items-center justify-between gap-3"><strong>{t("Режим отладки")}</strong><Switch id={switchId} checked={enabled} disabled={busy || !loaded} onCheckedChange={checked => void change(checked)} /></label>
    <p>{t("Сохранять в БД запросы и ответы моделей вашего аккаунта, точное время, длительность и аудио для диагностики распознавания.")}</p>
    <small>{t("Временно хранятся последние 20 аудиозаписей. При выключении все логи и аудио удаляются из БД.")}</small>
    {busy && <p role="status">{t("Сохраняем или загружаем режим отладки…")}</p>}
    {error && <p role="alert">{t(error)}</p>}
    {!busy && !loaded && <Button className="debug-retry-button justify-self-start" onClick={() => { setBusy(true); setError(undefined); setReload(value => value + 1); }}>{t("Повторить загрузку")}</Button>}
    </div>
  </section>;
}
