import { SettingsIcon } from "./SettingsIcon";
import { useEffect, useRef, useState } from "react";
import { sendFeedback, transcribeFeedback } from "./api/training";
import { t } from "./i18n";
import { supportsVoiceRecording, VoiceRecorder } from "./voiceRecorder";
import { cn } from "./shared/lib/utils";
import { Button } from "./shared/ui/button";
import { Textarea } from "./shared/ui/input";
import { settingsAction, settingsCard, settingsHeading, settingsSection } from "./settingsStyles";

export function FeedbackSettings() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [state, setState] = useState<"idle" | "connecting" | "recording" | "transcribing" | "sending">("idle");
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const recorder = useRef<VoiceRecorder | undefined>(undefined);
  const controller = useRef<AbortController | undefined>(undefined);
  const epoch = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function stop() {
    epoch.current += 1;
    recorder.current?.stop();
    recorder.current = undefined;
    controller.current?.abort();
    clearTimeout(timer.current);
  }
  useEffect(() => {
    function suspend() {
      if (document.hidden) { stop(); setState("idle"); }
    }
    function leave() { stop(); setState("idle"); }
    document.addEventListener("visibilitychange", suspend);
    window.addEventListener("pagehide", leave);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", suspend);
      window.removeEventListener("pagehide", leave);
    };
  }, []);

  async function startRecording() {
    const current = ++epoch.current;
    setError(false); setSent(false); setState("connecting");
    const voice = new VoiceRecorder();
    recorder.current = voice;
    try {
      await voice.start();
      if (current !== epoch.current) return;
      setState("recording");
      timer.current = setTimeout(() => { stop(); setState("idle"); setError(true); }, 60_000);
    } catch {
      if (current === epoch.current) { stop(); setState("idle"); setError(true); }
    }
  }

  async function finishRecording() {
    const current = epoch.current;
    clearTimeout(timer.current);
    setState("transcribing");
    const abort = new AbortController(); controller.current = abort;
    try {
      const recording = await recorder.current!.finish();
      recorder.current = undefined;
      if (current !== epoch.current) return;
      const transcript = await transcribeFeedback(recording.audio, abort.signal);
      if (current === epoch.current) {
        setContent(previous => `${previous}${previous ? "\n" : ""}${transcript.text}`.slice(0, 5000));
      }
    } catch {
      if (current === epoch.current) setError(true);
    } finally {
      if (current === epoch.current) { recorder.current?.stop(); recorder.current = undefined; setState("idle"); }
    }
  }

  async function submit() {
    const current = ++epoch.current;
    const abort = new AbortController(); controller.current = abort;
    setError(false); setSent(false); setState("sending");
    try {
      await sendFeedback(content.trim(), abort.signal);
      if (current === epoch.current) { setSent(true); setContent(""); setOpen(false); }
    } catch {
      if (current === epoch.current) setError(true);
    } finally {
      if (current === epoch.current) setState("idle");
    }
  }

  const busy = state !== "idle";
  return <section className={cn("feedback-settings", settingsSection)} aria-labelledby="feedback-settings-title">
    <h2 id="feedback-settings-title" className={settingsHeading}>{t("settings.leaveFeedback")}</h2>
    {!open && <button className={cn(settingsCard, settingsAction)} type="button" onClick={() => { setOpen(true); setSent(false); setError(false); }}><SettingsIcon name="feedback" /><strong>{t("settings.writeRecordFeedback")}</strong></button>}
    {sent && <p className="m-0 text-sm" role="status">{t("settings.thankYouFeedbackHas")}</p>}
    {open && <form className="grid gap-3 rounded-card border border-line bg-surface p-4 [&>p]:m-0 [&>p]:text-sm [&>p]:leading-normal [&>p]:text-ink-muted" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label htmlFor="feedback-content" className="text-sm text-ink-soft">{t("settings.feedbackLabel")}</label>
      <Textarea id="feedback-content" maxLength={5000} rows={5} value={content} disabled={busy} onChange={event => setContent(event.target.value)} />
      <p>{t("settings.writeFeedbackRecordUp")}</p>
      <div className="feedback-settings__actions flex flex-wrap gap-2">
        <Button disabled={!supportsVoiceRecording() || (busy && state !== "recording")} onClick={() => void (state === "recording" ? finishRecording() : startRecording())}>{t(state === "recording" ? "settings.finishRecording" : "settings.recordFeedback")}</Button>
        <Button variant="primary" type="submit" disabled={busy || !content.trim()}>{t(state === "sending" ? "settings.sending" : "settings.sendFeedback")}</Button>
        <Button onClick={() => { stop(); setState("idle"); setOpen(false); setError(false); }}>{t("premium.close")}</Button>
      </div>
      {state !== "idle" && <p role="status">{t(state === "connecting" ? "settings.connectingMicrophone" : state === "recording" ? "settings.recordingAudioNotSaved" : state === "transcribing" ? "settings.transcribingFeedback" : "settings.sending")}</p>}
      {!supportsVoiceRecording() && <p>{t("settings.voiceInputUnavailablePlease")}</p>}
      {error && <p role="alert">{t("settings.actionFailedTextStill")}</p>}
    </form>}
  </section>;
}
