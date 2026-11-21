import { useCallback, useRef, useState, type RefObject } from "react";
import { revealWordHint } from "../../api/training";
import { t } from "../../i18n";
import type { Exercise, WordHint } from "../../types/training";

/**
 * Word hints for the current phrase: which words were revealed (shown and charged), which popover is
 * open, and the reveal requests in flight. A request only lands if both the practice flow epoch (owned
 * by the caller) and the hint epoch are unchanged since it started, so a late answer never leaks into
 * the next phrase or attempt.
 */
export function useWordHints({ exercise, checkingRef, flowEpochRef, onClearError, onClearDiagnostic, onError }: {
  exercise?: Exercise;
  checkingRef: RefObject<boolean>;
  flowEpochRef: RefObject<number>;
  /** Called when the word already has a hint to show (the old error no longer applies). */
  onClearError: () => void;
  onClearDiagnostic: () => void;
  onError: (message: string) => void;
}) {
  const [wordHints, setWordHints] = useState<Record<string, WordHint>>({});
  const [activeHint, setActiveHint] = useState<string>();
  const wordHintsRef = useRef<Record<string, WordHint>>({});
  const savedHintsRef = useRef(new Set<string>());
  const hintRequestsRef = useRef(new Map<string, AbortController>());
  const hintEpochRef = useRef(0);

  /** Requests started before this point no longer apply. */
  const invalidate = useCallback(() => { hintEpochRef.current += 1; }, []);
  /** Forget revealed and saved hints without re-rendering (the next phrase starts clean). */
  const forget = useCallback(() => { savedHintsRef.current.clear(); wordHintsRef.current = {}; }, []);
  /** Clear what the phrase shows: no revealed hints, no open popover. */
  const resetView = useCallback(() => { setWordHints({}); setActiveHint(undefined); }, []);
  const dismiss = useCallback(() => setActiveHint(undefined), []);
  /** Stop every request in flight (unmount, sign-out). */
  const abortAll = useCallback(() => {
    hintEpochRef.current += 1;
    for (const request of hintRequestsRef.current.values()) request.abort();
    hintRequestsRef.current.clear();
  }, []);
  /** Words whose hint was revealed for the current attempt, for the hint penalty. */
  const hintedWords = useCallback(() => Object.keys(wordHintsRef.current).sort(), []);

  async function reveal(word: string, localHint?: Pick<WordHint, "word_ru" | "translation_tr">) {
    if (!exercise || checkingRef.current) return;
    const normalized = word.toLocaleLowerCase("ru-RU");
    setActiveHint(current => current === normalized ? undefined : normalized);
    const requestKey = `${hintEpochRef.current}:${normalized}`;
    if (hintRequestsRef.current.has(requestKey) || savedHintsRef.current.has(normalized)) return;
    const prepared = localHint ?? exercise.word_hints?.find((hint) => hint.word_ru.toLocaleLowerCase("ru-RU") === normalized);
    const epoch = flowEpochRef.current;
    const hintEpoch = hintEpochRef.current;
    if (prepared && !wordHintsRef.current[normalized]) {
      const opened = { ...prepared, is_learning: true };
      wordHintsRef.current = { ...wordHintsRef.current, [normalized]: opened };
      setWordHints(wordHintsRef.current);
    }
    if (wordHintsRef.current[normalized]) onClearError();
    onClearDiagnostic();
    const controller = new AbortController();
    hintRequestsRef.current.set(requestKey, controller);
    try {
      const hint = await revealWordHint(exercise.id, word, controller.signal);
      if (flowEpochRef.current === epoch && hintEpochRef.current === hintEpoch) {
        savedHintsRef.current.add(normalized);
        wordHintsRef.current = { ...wordHintsRef.current, [normalized]: hint };
        setWordHints(wordHintsRef.current);
      }
    } catch {
      if (flowEpochRef.current === epoch && hintEpochRef.current === hintEpoch) onError(
        wordHintsRef.current[normalized]
          ? t("app.hintNotSaved", { word })
          : t("app.hintUnavailable", { word }),
      );
    } finally {
      if (hintRequestsRef.current.get(requestKey) === controller) hintRequestsRef.current.delete(requestKey);
    }
  }

  return { wordHints, activeHint, reveal, dismiss, invalidate, forget, resetView, abortAll, hintedWords };
}
