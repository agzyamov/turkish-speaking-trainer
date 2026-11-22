# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The same React build runs in the browser and inside a Capacitor Android WebView. Design language is web, phone-first.

## Users

Russian- or English-speaking adults, often relocating to or living in Turkey, who already know some Turkish words and want to actually speak everyday Turkish at CEFR A2: at the bank, the doctor, renting a flat, in a café, on public transport, at work. They practise in short daily sessions, mostly on their phone.

Other roles: Premium learners (higher daily limit, personal topics and phrases), an admin (payments, users, AI spend, debugging), and a store reviewer with a dedicated login.

## Product Purpose

The learner sees a short real-life phrase in Russian or English, says it in Turkish, and gets an immediate score with an explanation of what to fix. Phrases they miss come back on a spaced-repetition schedule. Success is fast, natural production of everyday phrases, not knowledge of grammar rules.

## Positioning

Production over recognition: the learner says whole everyday sentences out loud instead of tapping to match words, and gets a graded answer with a specific explanation, then meets missed phrases again on spaced repetition.

## Operating Context

- Core loop: pick a topic, see the phrase (tap a word for a hint, which costs points), record an answer, correct the transcript if needed, check, read the result, next phrase.
- Nine preset topics (job interview, bank, holiday, café, work, doctor, renting, transport, miscellaneous everyday talk) with 210 curated phrases; Premium learners add their own topics and phrases.
- Statistics: an activity calendar and per-topic phrase progress.
- AI checking runs against a strict shared monthly budget and a per-learner daily allowance. When it runs out, practice pauses with an explanation; typed answers that exactly match the reference are still checked.

## Capabilities and Constraints

- Every interface string exists in Russian and English; Russian is the default. Turkish appears only as the target language, in Latin script with its full alphabet (ç ğ ı İ ö ş ü).
- One UI serves the web app and the Android app; phone widths are the primary case.
- Free tier with a daily phrase limit; Premium raises the limit and unlocks personal topics and phrases.
- Audio is never stored.
- Architecture rules live in `docs/architecture/`; they are binding for implementation.

## Brand Commitments

- The product name is not final. "TurkTalk" is a working name held in one place (ADR-0005); do not build the identity around the name.

## Evidence on Hand

- Curated phrase catalogue: `backend/app/db/catalog_tr/` (pending review by a native speaker).
- No testimonials, user numbers, ratings or press exist. Do not invent them.

## Product Principles

1. Speaking first: every screen moves the learner toward saying the phrase out loud.
2. Feedback names the fix: a score is always paired with what to change.
3. Calm, short sessions: a few minutes a day on a phone, one phrase at a time.
4. Honest limits: when practice is limited or paused, say why and when it resumes.
5. Two languages, one product: Russian and English learners get the same quality.

## Accessibility & Inclusion

- Touch targets at least 44px; full keyboard operation on web; visible focus.
- Microphone denial or failure always leaves a typed-answer path.
