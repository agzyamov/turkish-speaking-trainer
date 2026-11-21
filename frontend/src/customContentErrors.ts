import { BackendError } from "./api/training";
import { budgetPauseMessage } from "./budgetPause";

export const topicLimitMessage = "premium.limit.topics";
export const phraseLimitMessage = "premium.limit.phrasesPerTopic";
export function customContentError(error: unknown, fallback: string): string {
  if (!(error instanceof BackendError)) return fallback;
  const budgetPause = budgetPauseMessage(error);
  if (budgetPause) return budgetPause;
  const messages: Record<string, string> = {
    topic_translation_unavailable: "premium.couldNotTranslateTopic",
    custom_topic_limit: topicLimitMessage,
    custom_phrase_limit: phraseLimitMessage,
    custom_total_phrase_limit: "premium.limit.phrasesTotal",
    custom_topic_required: "premium.chooseOneCustomTopics",
    phrase_preparation_expired: "premium.preparedTranslationHasExpired",
    phrase_preparation_used: "premium.translationHasAlreadyBeen",
    phrase_already_exists: "premium.phraseAlreadyExistsAnother",
  };
  if (error.code && messages[error.code]) return messages[error.code];
  if (Array.isArray(error.detail) && error.detail.some(item => item?.type === "phrase_word_limit")) return "premium.phraseMustContainNo";
  return fallback;
}
