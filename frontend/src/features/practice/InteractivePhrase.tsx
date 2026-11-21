import { t } from "../../i18n";
import { exerciseSource } from "../../exerciseSource";
import { splitHintFragments } from "../../sourceWords";
import type { Exercise, WordHint } from "../../types/training";
import { WordHintToken } from "../../WordHintToken";

type LocalHint = { translation_tr: string; note?: string };

/** The source sentence with tap-to-reveal word hints. Renders nothing when the phrase is unavailable in this language. */
export function InteractivePhrase({
  exercise,
  wordHints,
  activeHint,
  hintsVisible,
  disabled,
  onDismissHint,
  onRevealHint,
}: {
  exercise?: Exercise;
  wordHints: Record<string, Pick<WordHint, "translation_tr"> | undefined>;
  activeHint?: string;
  hintsVisible: boolean;
  disabled: boolean;
  onDismissHint: () => void;
  onRevealHint: (word: string, localHint: Pick<WordHint, "word_ru" | "translation_tr">) => void;
}) {
  const localized = exercise ? exerciseSource(exercise) : undefined;
  const hints: Record<string, LocalHint | undefined> = localized?.hints ?? {};
  if (exercise && !localized) return null;
  return (
    <h2
      id="exercise-title"
      className="interactive-phrase m-0 font-display text-phrase font-medium text-ink [text-wrap:balance] sm:text-phrase-lg"
      aria-label={localized ? localized.source : t("practice.phrase.preparing")}
    >
      {exercise && localized
        ? splitHintFragments(localized.source, Object.keys(hints)).map((part, index) => {
            const normalized = part.toLocaleLowerCase("ru-RU");
            const localHint = Object.hasOwn(hints, normalized) ? hints[normalized] : undefined;
            if (!localHint) return <span key={index}>{part}</span>;
            const revealed = wordHints[normalized];
            return (
              <WordHintToken
                key={`${part}-${index}`}
                word={part}
                used={Boolean(revealed)}
                disabled={disabled}
                onDismiss={onDismissHint}
                active={activeHint === normalized && hintsVisible}
                translation={revealed ? [revealed.translation_tr, localHint.note ? t(localHint.note) : ""].filter(Boolean).join(" · ") : t("practice.phrase.loadingHint")}
                onClick={() => onRevealHint(part, { word_ru: part, translation_tr: localHint.translation_tr })}
              />
            );
          })
        : t("practice.phrase.preparing")}
    </h2>
  );
}
