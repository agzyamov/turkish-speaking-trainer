import { SettingsIcon } from "./SettingsIcon";
import { useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { t, useLanguage } from "./i18n";
import { cn } from "./shared/lib/utils";
import { Input } from "./shared/ui/input";
import { settingsAction, settingsCard, settingsCopy, settingsHeading, settingsSection } from "./settingsStyles";

// Public web entry point: recipients do not need access to the closed Play test.
export const publicAppUrl = "https://serbotalk.app/";

export function ShareAppSettings() {
  useLanguage();
  const [state, setState] = useState<"idle" | "sharing" | "copying" | "copied" | "error">("idle");
  const pending = useRef(false);

  async function perform(copyOnly = false) {
    if (pending.current) return;
    pending.current = true;
    const nativeShare = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share");
    const canShare = nativeShare || typeof navigator.share === "function";
    setState(copyOnly || !canShare ? "copying" : "sharing");
    try {
      if (copyOnly || !canShare) {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(publicAppUrl);
        setState("copied");
      } else {
        const data = { title: "SerboTalk", text: t("settings.practiseSpeakingTurkishSerbotalk"), url: publicAppUrl };
        // Call directly from the click, before any await, to preserve user activation.
        if (nativeShare) await Share.share({ ...data, dialogTitle: t("settings.shareApp") });
        else await navigator.share(data);
        setState("idle");
      }
    } catch (error) {
      // Capacitor Android uses this message; browsers use AbortError.
      const cancelled = typeof error === "object" && error !== null && (
        ("name" in error && error.name === "AbortError") || ("message" in error && error.message === "Share canceled")
      );
      setState(cancelled ? "idle" : "error");
    } finally {
      pending.current = false;
    }
  }

  const busy = state === "sharing" || state === "copying";
  return <section className={cn("share-app-settings", settingsSection)} aria-labelledby="share-app-title">
    <h2 id="share-app-title" className={settingsHeading}>{t("settings.shareApp")}</h2>
    <p>{t("settings.inviteFriendsPractiseTurkish")}</p>
    <div className="share-app-settings__actions grid min-w-0 grid-cols-3 gap-3.5 max-[640px]:grid-cols-2 max-[640px]:gap-2.5">
      <button className={cn(settingsCard, settingsAction, "max-[640px]:flex-col max-[640px]:items-start")} type="button" disabled={busy} onClick={() => void perform()}><SettingsIcon name="share" /><strong>{t("settings.share")}</strong></button>
      <button className={cn(settingsCard, settingsAction, "max-[640px]:flex-col max-[640px]:items-start")} type="button" disabled={busy} onClick={() => void perform(true)}><SettingsIcon name="link" /><strong>{t("settings.copyLink")}</strong></button>
      <div className={cn(settingsCard, "settings-url items-center max-[640px]:col-span-full [&_.settings-icon]:size-8 [&_.settings-icon>svg]:size-5.5")}><SettingsIcon name="link" /><div className={settingsCopy}><label htmlFor="share-app-url" className="text-sm text-ink-soft">{t("settings.appLink")}</label><Input className="py-2" id="share-app-url" type="url" readOnly value={publicAppUrl} onFocus={event => event.currentTarget.select()} /></div></div>
    </div>
    {busy && <p role="status">{t(state === "sharing" ? "settings.openingShareMenu" : "settings.copyingLink")}</p>}
    {state === "copied" && <p role="status">{t("settings.linkCopied")}</p>}
    {state === "error" && <p role="alert">{t("settings.couldNotShareCopy")}</p>}
  </section>;
}
