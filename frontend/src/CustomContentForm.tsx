import { useState } from "react";
import { addReviewPhrase, createTopic, prepareReviewPhrase } from "./api/training";
import { t, topicText } from "./i18n";
import type { PreparedReviewPhrase, TopicListItem } from "./types/training";
import { customContentError, phraseLimitMessage, topicLimitMessage } from "./customContentErrors";
import { sortedPersonalTopics } from "./personalTopics";
import { Button } from "./shared/ui/button";
import { Field, Input, Select } from "./shared/ui/input";

import { contentCard } from "./customContentStyles";

export function CustomContentForm({ mode, topics, selectedTopic, onTopicCreated, onPhraseSaved, onClose, onManage, onCreateTopic }: {
  mode: "topic" | "phrase"; topics: TopicListItem[]; selectedTopic?: string;
  onTopicCreated: (topic: TopicListItem) => void; onPhraseSaved: () => void; onClose: () => void;
  onManage?: () => void; onCreateTopic?: () => void;
}) {
  const ownTopics = sortedPersonalTopics(topics);
  const [text, setText] = useState("");
  const [topicId, setTopicId] = useState(ownTopics.find(topic => topic.id === selectedTopic)?.id ?? ownTopics[0]?.id ?? "");
  const [prepared, setPrepared] = useState<PreparedReviewPhrase>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const clean = text.trim().replace(/\s+/g, " ");

  const words = clean ? clean.split(/\s+/).length : 0;
  const selected = ownTopics.find(topic => topic.id === topicId);
  const limitMessage = mode === "topic" ? ownTopics.length >= 5 ? topicLimitMessage : "" : (selected?.custom_phrase_count ?? 0) >= 30 ? phraseLimitMessage : "";
  const blocked = Boolean(limitMessage) || (mode === "phrase" && (words > 15 || !selected));

  async function submit() {
    if (busy || blocked || clean.length < (mode === "topic" ? 2 : 3)) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      if (mode === "topic") {
        onTopicCreated(await createTopic(clean));
        setText(""); setSaved(true);
      } else if (!prepared) {
        setPrepared(await prepareReviewPhrase(clean));
      } else {
        await addReviewPhrase(prepared, topicId);
        onPhraseSaved();
        setText(""); setPrepared(undefined); setSaved(true);
      }
    } catch (failure) {
      setError(customContentError(failure, mode === "topic" ? "premium.couldNotSaveTopic" : prepared ? "premium.couldNotSavePhrase" : "premium.couldNotPrepareTranslation"));
    } finally { setBusy(false); }
  }

  return <form className={contentCard} aria-label={t(mode === "topic" ? "premium.addTopic" : "premium.addPhrase")} onSubmit={event => { event.preventDefault(); void submit(); }}>
    <Field>{t(mode === "topic" ? "premium.topicName" : "premium.phraseRussian")}
      <Input value={text} minLength={mode === "topic" ? 2 : 3} maxLength={mode === "topic" ? 160 : 240} required disabled={busy} onChange={event => { setText(event.target.value); setPrepared(undefined); setSaved(false); setError(""); }} />
    </Field>
    {mode === "topic" ? <><p>{t("premium.topicEmptyAddPhrases")}</p><p>{t("premium.titleAutomaticallyTranslatedInto")}</p><p>{t("premium.counts.topics", { count: ownTopics.length })}</p></> : <>
      <p>{t("premium.counts.words", { count: words })}</p>
      {words > 15 && <p role="alert">{t("premium.phraseMustContainNo")}</p>}
      <p>{t("premium.modelCreatesCanonicalTranslation")}</p>
      <p>{t("premium.addingSamePhraseAgain")}</p>
      {ownTopics.length === 0 ? <p role="status">{t("premium.createCustomTopicPhrases")}</p> : <Field>{t("premium.topicPhrase")}<Select value={topicId} required disabled={busy} onChange={event => setTopicId(event.target.value)}>
        {ownTopics.map(topic => <option key={topic.id} value={topic.id}>{topicText(topic.id, topic.title_ru, topic.title_en)}</option>)}
      </Select><span className="text-caption text-ink-muted">{t("premium.counts.topicPhrases", { count: selected?.custom_phrase_count ?? 0 })}</span></Field>}
      {prepared && <>
        {prepared.source_versions && <div className="custom-content-translation grid gap-1 rounded-control border border-line bg-surface-raised p-3 [&_p]:text-ink!">
          <p lang="ru"><strong>{t("premium.russianVersion")}: </strong>{prepared.source_versions.ru}</p>
          <p lang="en"><strong>{t("premium.englishVersion")}: </strong>{prepared.source_versions.en}</p>
        </div>}
        <p className="custom-content-translation text-answer! text-ink!" lang="tr" role="status">{prepared.canonical_tr}</p>
        <Button className="justify-self-start" disabled={busy} onClick={() => { setPrepared(undefined); setError(""); }}>{t("premium.prepareTranslationAgain")}</Button>
      </>}
    </>}
    {limitMessage && <p role="alert">{t(limitMessage)}</p>}
    {error && <p role="alert">{t(error)}</p>}
    {saved && <p role="status">{t(mode === "topic" ? "premium.topicSaved" : "premium.phraseSaved")}</p>}
    <Button variant="primary" className="justify-self-start" type="submit" disabled={busy || blocked || clean.length < (mode === "topic" ? 2 : 3)}>{t(busy ? mode === "topic" ? "premium.translatingTitle" : (mode === "phrase" && !prepared ? "premium.preparingTranslation" : "premium.saving") : mode === "topic" ? "premium.saveTopic" : prepared ? "premium.savePhrase" : "premium.prepareTranslation")}</Button>
    {mode === "phrase" && ownTopics.length === 0 && onCreateTopic && <Button className="justify-self-start" disabled={busy} onClick={onCreateTopic}>{t("premium.createCustomTopic")}</Button>}
    {onManage && <Button className="justify-self-start" disabled={busy} onClick={onManage}>{t("premium.deletePhrasesTopics")}</Button>}
    <Button className="justify-self-start" disabled={busy} onClick={onClose}>{t("premium.close")}</Button>
  </form>;
}
