---
version: 1
slug: "frontend-src-features-practice-practicecard-tsx"
primary_target: "frontend/src/features/practice/PracticeCard.tsx"
related_targets: ["frontend/src/features/practice/ExerciseFeedback.tsx"]
---

Scope: the practice screen (phrase, answer, check, result, paused state), web and Android WebView, phone first. Mode: Operate.

Audience and task: Russian- or English-speaking adults in Turkey practising spoken Turkish at A2 in short sessions; say the phrase, check it, learn the fix, move on.

## Direction contract

THESIS: A practice session is one glass of tea on the Bosphorus ferry in daylight: calm, light, one phrase at a time. Refuses the category default of a dark shell with glowing icon discs and a hidden "analysis".

OWN-WORLD: Porcelain ground (#fbf7ef), near-white surfaces, Bosphorus-navy ink (#12233f), ruby tea (#b3261e) for the one primary action and hint words, tulip-glass gold for rewards, leaf green for correct, raspberry (#a3145a) for marked mistakes, sea teal (#1a6878) for focus and calm information. Alegreya Sans for the phrase; system sans for UI. One soft ink-tinted offset shadow only; no glow. (Replaced the dark evening tea-house world with its amber accent on 2026-11-22; the FORM line below records the original roll.)

STORY: The learner reads the phrase, taps a dotted word if stuck (and is told it costs points), records, fixes the transcript if needed, checks, sees a score that stays, the prompt, their marked answer, the correct answer and an expanded list of fixes, then moves on; a spent AI budget reads as a calm notice with a resume time.

FIRST VIEWPORT: Top row: topic name left, tulip tea glass right filling with session progress. Below: the phrase large in Alegreya Sans with dotted ruby hint words and a one-line hint legend. Bottom (thumb zone): one ruby microphone disc and the status line; after recording, a full-width labelled "Проверить" with a secondary "Заново".

FORM: grounded candidate 3 of 7 (tea house ritual). seed: 3cf8d1c9a889b563

Signature interaction: session progress as a tulip tea glass that fills phrase by phrase (one session = one glass).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Unresolved: the surrounding shell (header, topic list, statistics, premium) is still the legacy navy world and is migrated next; result labels ("Ваш вариант" / "Правильный вариант") and the Next button wording still differ between layouts.
