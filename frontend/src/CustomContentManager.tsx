import { useEffect, useRef, useState } from "react";
import { deleteCustomPhrase, deleteCustomTopic, fetchCustomPhrases } from "./api/training";
import { t, topicText, getLanguage } from "./i18n";
import type { ReviewPhrase, TopicListItem } from "./types/training";
import { sortedPersonalTopics } from "./personalTopics";
import { Button } from "./shared/ui/button";
import { cn } from "./shared/lib/utils";
import { contentCard, contentItem } from "./customContentStyles";

export function CustomContentManager({ topics, onDeleted, onClose, browseTopics = false }: {
  topics: TopicListItem[];
  onDeleted: (topicId?: string) => void; onClose: () => void;
  browseTopics?: boolean;
}) {
  const [phrases, setPhrases] = useState<ReviewPhrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{ kind: "topic" | "phrase"; id: string; title: string }>();
  const [message, setMessage] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>();
  const confirmationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (confirmation) {
      confirmationRef.current?.focus();
      confirmationRef.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [confirmation]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCustomPhrases(controller.signal).then(result => { if (!controller.signal.aborted) setPhrases(result); })
      .catch(() => { if (!controller.signal.aborted) setError("Не удалось загрузить свои фразы."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  async function remove() {
    if (!confirmation || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (confirmation.kind === "topic") {
        await deleteCustomTopic(confirmation.id);
        setPhrases(current => current.filter(phrase => phrase.topic_id !== confirmation.id));
        onDeleted(confirmation.id);
      } else {
        await deleteCustomPhrase(confirmation.id);
        setPhrases(current => current.filter(phrase => phrase.id !== confirmation.id));
        onDeleted();
      }
      setMessage(confirmation.kind === "topic" ? "Тема и все её фразы удалены." : "Фраза удалена.");
      setConfirmation(undefined);
    } catch {
      setError("Не удалось удалить. Повторите попытку.");
    } finally { setBusy(false); }
  }

  return <section className={cn(contentCard, "custom-content-manager")} aria-label={t("Свои темы и фразы")}>
    <h3 className="m-0 text-base font-semibold text-ink">{t("Свои темы и фразы")}</h3>
    {!browseTopics && <Button className="justify-self-start" disabled={busy} onClick={onClose}>{t("Закрыть")}</Button>}
    <p>{t("До 5 своих тем, до 30 фраз в каждой. Всего до 150 фраз.")}</p>
    <p>{t("Удаление темы удалит все её фразы из обучения и повторения. История выполненных попыток останется в статистике.")}</p>
    {loading && <p role="status">{t("Загружаем свои фразы…")}</p>}
    {error && <div role="alert" className="border-l-2 border-danger pl-3 [&>p]:text-danger!"><p>{t(error)}</p>{!confirmation && <Button className="mt-2" disabled={busy} onClick={() => { setLoading(true); setError(""); setRetry(value => value + 1); }}>{t("Повторить загрузку")}</Button>}</div>}
    {message && <p role="status">{t(message)}</p>}
    {confirmation && <div ref={confirmationRef} tabIndex={-1} className="custom-content-confirmation flex flex-wrap items-center gap-2 rounded-control border border-danger/60 bg-surface-raised p-3 outline-none focus-visible:ring-2 focus-visible:ring-focus [&>p]:basis-full [&>strong]:basis-full [&>strong]:[overflow-wrap:anywhere]" role="group" aria-label={t("Подтверждение удаления")}>
      <p>{t(confirmation.kind === "topic" ? "Удалить тему и все её фразы?" : "Удалить свою фразу?")}</p>
      <strong>{confirmation.title}</strong>
      <Button variant="danger" disabled={busy} onClick={() => void remove()}>{t(busy ? "Удаляем…" : "Подтвердить удаление")}</Button>
      <Button disabled={busy} onClick={() => { setConfirmation(undefined); setError(""); }}>{t("Отмена")}</Button>
    </div>}
    <div className={cn("grid min-w-0 gap-3", browseTopics && "premium-catalog-grid grid-cols-2")}>
    {sortedPersonalTopics(topics).map(topic => <div className={cn(contentItem, browseTopics && "border-reward/70 has-[[aria-pressed=true]]:border-accent has-[[aria-pressed=true]]:bg-selected")} key={topic.id}>
      {browseTopics ? <button className="premium-topic flex min-h-20 w-full flex-1 cursor-pointer flex-col items-start justify-between gap-2 rounded-control border-0 bg-transparent p-0 text-left text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default disabled:opacity-60" type="button" aria-pressed={selectedTopic === topic.id} disabled={busy || Boolean(confirmation)} onClick={() => { setSelectedTopic(topic.id); setMessage(""); }}>
        <strong className="w-full text-sm leading-snug hyphens-auto [overflow-wrap:anywhere]">{topicText(topic.id, topic.title_ru, topic.title_en)}</strong>
        <span className="shrink-0 text-caption text-ink-muted">{t("Фраз: ")}{loading ? topic.custom_phrase_count ?? 0 : phrases.filter(phrase => phrase.topic_id === topic.id).length}</span>
      </button> : <><strong className="text-sm">{topicText(topic.id, topic.title_ru, topic.title_en)}</strong><span className="text-caption text-ink-muted">{topic.custom_phrase_count ?? phrases.filter(phrase => phrase.topic_id === topic.id).length} / 30</span></>}
      <Button className="mt-auto self-start px-3 text-sm" disabled={busy || Boolean(confirmation)} onClick={() => setConfirmation({ kind: "topic", id: topic.id, title: topicText(topic.id, topic.title_ru, topic.title_en) })}>{t("Удалить тему")}</Button>
    </div>)}
    </div>
    {!loading && phrases.length === 0 && <p>{t("Своих фраз пока нет.")}</p>}
    {browseTopics && !selectedTopic && phrases.length > 0 && <p>{t("Выберите тему, чтобы увидеть фразы.")}</p>}
    {browseTopics && selectedTopic && !loading && !phrases.some(phrase => phrase.topic_id === selectedTopic) && <p>{t("В этой теме пока нет своих фраз.")}</p>}
    <div className={cn("grid min-w-0 gap-3", browseTopics && "premium-phrase-grid grid-cols-2")}>
    {phrases.filter(phrase => !browseTopics || phrase.topic_id === selectedTopic).map(phrase => <div className={contentItem} key={phrase.id}>
      <strong className="text-sm leading-snug">{phrase.source_versions?.[getLanguage()] ?? phrase.source_ru}</strong>
      {!browseTopics && <><span className="text-ink" lang="tr">{phrase.canonical_tr}</span><small className="text-caption text-ink-muted">{topicText(phrase.topic_id, phrase.topic_title ?? "", topics.find(topic => topic.id === phrase.topic_id)?.title_en)}</small></>}
      <Button className="mt-auto self-start px-3 text-sm" disabled={busy || Boolean(confirmation)} onClick={() => setConfirmation({ kind: "phrase", id: phrase.id, title: phrase.source_ru })}>{t("Удалить фразу")}</Button>
    </div>)}
    </div>
  </section>;
}
