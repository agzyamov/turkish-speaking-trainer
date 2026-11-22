---
name: TurkTalk
description: A Turkish speaking trainer; one phrase at a time, like one glass of tea on the Bosphorus ferry in daylight.
colors:
  porcelain: "#fbf7ef"
  porcelain-white: "#fffdf8"
  porcelain-raised: "#f1eadc"
  ruby-selected: "rgb(179 38 30 / 0.1)"
  bosphorus-ink: "#12233f"
  bosphorus-ink-soft: "#33435e"
  bosphorus-ink-muted: "#5c6a81"
  hairline: "rgb(18 35 63 / 0.14)"
  sea-teal: "#1a6878"
  ruby-tea: "#b3261e"
  ruby-tea-bright: "#c8372e"
  on-ruby: "#ffffff"
  leaf-green: "#17693f"
  tulip-gold: "#8a6400"
  raspberry: "#a3145a"
typography:
  phrase:
    fontFamily: "Alegreya Sans, system-ui, Segoe UI, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 500
    lineHeight: 1.22
  phrase-lg:
    fontFamily: "Alegreya Sans, system-ui, Segoe UI, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: 1.2
  score:
    fontFamily: "Alegreya Sans, system-ui, Segoe UI, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  title:
    fontFamily: "system-ui, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
  title-compact:
    fontFamily: "system-ui, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "1.55rem"
    fontWeight: 700
    lineHeight: 1.2
  answer:
    fontFamily: "system-ui, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "system-ui, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  control: "10px"
  card: "16px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ruby-tea}"
    textColor: "{colors.on-ruby}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.ruby-tea-bright}"
  button-secondary:
    backgroundColor: "{colors.porcelain-raised}"
    textColor: "{colors.bosphorus-ink-soft}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "52px"
  button-secondary-hover:
    textColor: "{colors.bosphorus-ink}"
  button-danger:
    backgroundColor: "{colors.porcelain-white}"
    textColor: "{colors.raspberry}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "44px"
  mic-disc:
    backgroundColor: "{colors.ruby-tea}"
    textColor: "{colors.on-ruby}"
    rounded: "{rounded.full}"
    size: "72px"
  mic-disc-recording:
    backgroundColor: "{colors.raspberry}"
    textColor: "{colors.on-ruby}"
  card:
    backgroundColor: "{colors.porcelain-white}"
    textColor: "{colors.bosphorus-ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  input-answer:
    backgroundColor: "{colors.porcelain-raised}"
    textColor: "{colors.bosphorus-ink}"
    typography: "{typography.answer}"
    rounded: "{rounded.control}"
    padding: "16px"
  word-tooltip:
    backgroundColor: "{colors.porcelain-raised}"
    textColor: "{colors.bosphorus-ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  pause-notice:
    textColor: "{colors.bosphorus-ink}"
    rounded: "{rounded.card}"
    padding: "16px"
---

# Design System: TurkTalk

<!-- Scope: this system covers the screens migrated onto the Tailwind tokens (the app shell and topic chooser, the practice screen, Settings, and the shared/ui primitives). The legacy stylesheet (frontend/src/styles.css, loaded in the lower "legacy" cascade layer) still lays out statistics, premium, login and legal pages; its colours now resolve to these tokens, but its radii, sizes and class structure are not part of this system: do not copy them into new work. -->

## Overview

**Creative North Star: "One Glass of Tea"**

A practice session is one glass of tea on the Bosphorus ferry, in daylight: a porcelain ground, near-white surfaces, Bosphorus-navy text, and ruby tea as the single accent. The world is light and has no dark variant. The screen is calm and holds one thing at a time: one phrase, one primary action, one result. Progress is literal: a small tulip tea glass in the top row fills phrase by phrase, and one session is one glass.

Density is low and phone-first. The phrase is the largest thing on screen and sits in a humanist display face. Everything else is plain system sans in navy ink tones. Color carries meaning, not decoration: ruby means "act here" or "tap for a hint", and green, gold and raspberry are kept for the verdict. A paused or limited state is calm sea-teal information, never an error. Mistakes are raspberry, not red, so that they cannot be confused with the ruby accent.

Depth is quiet. Surfaces are tonal steps of porcelain separated by hairlines, and one soft shadow lifts only what floats or what should be pressed. Nothing glows. This world replaced the earlier dark one (an Istanbul tea house in the evening: strong-tea ground, walnut surfaces, amber accent) on 2026-11-22; the token names in `tokens.css` and the type, spacing and shapes did not change.

**Key Characteristics:**
- Light porcelain ground, a near-white surface and one raised porcelain step, Bosphorus-navy ink.
- One ruby accent: the primary action, hint words and the tea filling.
- Sea teal for focus, strong lines and calm information.
- Verdict colors (leaf green, tulip gold, raspberry) used only for results and recording.
- Alegreya Sans for the phrase and the score numeral; system sans for everything else.
- Flat tonal surfaces with hairline borders; one soft lift shadow, no glow.
- The logo and the progress mark are the same object: a tulip tea glass.
- Labelled, thumb-zone actions at least 44px tall (52px for the main action).

## Colors

A light, daylight palette: porcelain neutrals and navy ink with one ruby accent, sea teal for focus and information, and a small set of verdict colors. The values below are the ones in `frontend/src/shared/styles/tokens.css`; the token each name maps to is given in brackets.

### Primary
- **Ruby Tea** (ruby-tea, `--color-accent`, #b3261e): the color of Turkish tea in the glass. Fills the one primary action in each state (the microphone disc, "Check", "Next phrase"), the dotted underline of hint words (at 60%), a used hint's text and underline, the caret in the answer field, a switch or radio that is on, and the liquid in the tea glass.
- **Bright Ruby Tea** (ruby-tea-bright, `--color-accent-bright`, #c8372e): hover state of ruby actions and hover text of hint words; also links in Settings.
- **On Ruby** (on-ruby, `--color-accent-ink`, #ffffff): text and icons on ruby (and on the raspberry recording disc).
- **Ruby Selected** (ruby-selected, `--color-selected`, ruby at 10%): tinted background of a selected option.

### Secondary
- **Sea Teal** (sea-teal, #1a6878): the Bosphorus in daylight. One value behind three tokens: `--color-focus` (the 2px focus ring and focus outline on every interactive element), `--color-line-strong` (hover border of secondary controls, focused answer field, tooltip border, radio outlines) and `--color-info` (the AI-budget pause notice at 40% border and 10% fill; the wash behind the landing hero illustration).
- **Tulip Gold** (tulip-gold, `--color-reward`, #8a6400): the gold rim of a tulip glass. The rim line on the tea glass, the "mostly correct" score, the ring drawn once around a perfect score, and the reward medal border.

### Tertiary
- **Leaf Green** (leaf-green, `--color-success`, #17693f): a correct score, the "Correct version" box label and border (at 35% border, 8% fill), and corrections in the review list.
- **Raspberry** (raspberry, `--color-danger`, #a3145a): marked mistakes (underline plus 20% tint on the learner's answer, struck-through evidence), the "needs work" score, the recording state of the microphone, script warnings and destructive buttons. It is a pink-violet red, chosen so that a mistake does not look like the ruby accent.

### Neutral
- **Porcelain** (porcelain, `--color-canvas`, #fbf7ef): the page ground, the focus-ring offset color on the canvas, and the browser theme color in `frontend/index.html`.
- **Porcelain White** (porcelain-white, `--color-surface`, #fffdf8): the main surface: practice card, Settings cards, focus-ring offset inside the card.
- **Raised Porcelain** (porcelain-raised, `--color-surface-raised`, #f1eadc): one step darker than the ground: answer field, the learner's answer box, secondary buttons, tooltips, the empty part of the tea glass.
- **Bosphorus Ink** (bosphorus-ink, `--color-ink`, #12233f): deep navy. Primary text, phrase, answers; also the frame of the phone screenshots on the landing page.
- **Soft Bosphorus Ink** (bosphorus-ink-soft, `--color-ink-soft`, #33435e): secondary text such as explanations, secondary button labels, the tea-glass outline.
- **Muted Bosphorus Ink** (bosphorus-ink-muted, `--color-ink-muted`, #5c6a81): muted text: topic name, captions, field labels, status line, placeholders.
- **Hairline** (hairline, `--color-line`, ink at 14%): the default 1px border on cards, fields and secondary controls.

The Google sign-in button keeps Google's own colors (`--color-google*` in `tokens.css`); they are not part of this palette.

### Named Rules
**The One Ruby Rule.** Each state of a screen has exactly one ruby-filled control: the mic disc before an answer, "Check" with an answer, "Next" after the result. Everything else is porcelain with a hairline.

**The Verdict Palette Rule.** Leaf green, tulip gold and raspberry map to correct, mostly correct and needs work. They are not decorative colors and do not appear on neutral chrome.

**The Calm Limits Rule.** A spent budget, a pause or unavailable assistance is sea-teal information with the reason and the resume time. Raspberry is for mistakes the learner can fix, not for limits.

## Typography

**Display Font:** Alegreya Sans 400/500/700, self-hosted via Fontsource (with system-ui, Segoe UI, sans-serif)
**Body Font:** system-ui (with Segoe UI, Roboto, Arial, sans-serif)

**Character:** A warm humanist sans with calligraphic roots carries the phrase the learner must say; the platform's own sans does the quiet work around it. Alegreya Sans covers Cyrillic, Latin and the full Turkish alphabet (ç ğ ı İ ö ş ü).

### Hierarchy
- **Phrase** (500, 1.875rem, 1.22; 2.25rem / 1.2 from 640px): the source phrase in Russian or English, balanced wrapping. The largest text on the practice screen.
- **Score** (Alegreya Sans 700, 2.25rem, tabular numerals): the percentage in the verdict row, colored by verdict, followed by the verdict word in 1.125rem semibold ink.
- **Title** (700, 2rem, 1.2; compact 1.55rem in the Android layout): page headings such as Settings.
- **Answer** (400, 1.25rem, 1.45): anything in Turkish the learner reads or edits: the answer field, the learner's and the correct version, review corrections.
- **Body** (400, 0.875rem, normal leading): explanations, the voice status line, notices. Notice and section headings step up to 1rem semibold.
- **Label** (600, 0.8rem, 1.5): field and box labels ("Your answer", "Correct version"), sentence case. Captions use the same size at 400 in muted ink.

### Named Rules
**The Phrase Voice Rule.** Alegreya Sans is used only for the phrase to be spoken and the score numeral. Turkish answers and all interface text stay in system sans.

**The Sentence Case Rule.** Labels are short sentence-case words in muted ink or verdict color. No uppercase tracking, no label above a heading that repeats it.

## Layout

Phone first, one column. The practice screen is a vertical stack in three zones: a top row (topic name truncating on the left, tea glass on the right), a scrolling content area (phrase and hint legend, then the answer or the result), and a bottom control zone in the thumb area (mic disc and status line, or full-width labelled buttons). On the web the practice card is bounded to the viewport (`100dvh` minus the shell, minimum 32rem) so the controls stay on screen and the content scrolls; in the Android layout it fills the available height without its own border.

Spacing follows a 4px base: 8px between label and field, 12px between buttons and list items, 16px between form groups and inside boxes, 20px horizontal padding on phones and inside cards, 24px between content blocks, 32px horizontal padding from 640px. Settings uses a centered column capped at 980px with 16px gaps.

The single responsive step used is 640px (larger phrase, wider padding); the compact/Android variant is chosen by the app, not by a media query.

## Elevation & Depth

Flat by default, with tonal layering: porcelain ground, porcelain-white surface, raised porcelain for things inside the surface, separated by 1px hairlines. One soft shadow, tinted with the ink color, lifts only what should feel pressable or floating.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 6px 18px rgb(18 35 63 / 0.14)`): the primary ruby buttons, the microphone disc, the word-hint tooltip and the phone frames on the landing page.

### Named Rules
**The Lift, Not Glow Rule.** The one shadow is soft, offset downward and tinted with the navy ink at 14%. No bright-colored or zero-offset glows around controls, medals or icons.

## Shapes

Two gentle radii: 10px for controls (buttons, fields, result boxes, tooltips) and 16px for containers (cards, the practice card, notices). Circles are kept for the microphone disc, switches and radios. Borders are 1px hairlines; a 2px raspberry ring marks recording. Hint words are marked by a dotted 2px ruby underline (offset 0.22em) that turns solid once used; mistakes by a solid 2px raspberry underline. The one illustrative form inside the app is the tulip tea glass: the progress outline and the logo.

## Components

### Buttons
Labelled and calm: a word on every action, ruby only for the main one.
- **Shape:** gently curved (10px).
- **Primary:** ruby tea with white text, 16px semibold, lift shadow, at least 52px tall on the practice screen (44px in the shared Button). Full width in the control zone.
- **Hover / Focus:** hover changes to bright ruby tea over 150ms (`cubic-bezier(0.2, 0, 0, 1)`); focus is a 2px sea-teal ring offset 2px from the surface. Disabled drops to 55-60% opacity.
- **Secondary:** raised porcelain with a hairline border and soft ink text (porcelain white with ink text in the shared Button); hover turns the border sea teal and the text full ink. "Record again" pairs an icon with its word.
- **Danger:** porcelain white with raspberry text and a 60% raspberry border; hover makes the border solid.

### Microphone Disc
The one icon-only control: a 72px ruby circle with a 30px white line microphone and a lift shadow, in the thumb zone, with an accessible name. Presses scale to 95%. While recording it turns raspberry with a 2px raspberry ring that pings (motion-safe only); while connecting or transcribing it turns raised porcelain.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** porcelain white.
- **Shadow Strategy:** none; see Elevation.
- **Border:** 1px hairline.
- **Internal Padding:** 20px, 16px gaps.

### Inputs / Fields
- **Style:** raised porcelain, 1px hairline, 10px radius, 16px padding, answer type (1.25rem), ruby caret, muted-ink placeholder, labelled above in the label style.
- **Focus:** border turns sea teal plus the sea-teal focus ring.
- **Read-only:** 80% opacity while checking.
- **Switch / Radio:** hairline-bordered raised porcelain that fills ruby when on or checked.

### Result Boxes
Two stacked 10px boxes: the learner's version on raised porcelain with mistakes marked in raspberry (20% tint and a 2px underline), and the correct version tinted leaf green (35% border, 8% fill) with a green label. Above them the verdict row (score, verdict word, hint penalty with a bulb icon); below, an always-expanded review list of evidence struck through in raspberry, an arrow, the correction in green, and the explanation in soft ink.

### Word Hint
A tappable word in the phrase with a dotted ruby underline and a 44px tap area. Tapping opens a tooltip below the word (above only when there is no room): raised porcelain, sea-teal border, 10px radius, lift shadow, the Turkish translation in 1rem medium. A used hint stays solid ruby. A one-line caption under the phrase says that a hint lowers the score.

### Pause Notice
A 16px sea-teal tinted box (40% border, 10% fill) with a 1rem semibold heading, the reason and resume time in soft ink, the typed-answer fallback, and the diagnostic code tucked behind a "More" disclosure.

### Tea Glass
Session progress as a 24x36 tulip-glass outline in soft ink with a tulip-gold rim; ruby tea rises from the bottom as phrases are completed (700ms, `cubic-bezier(0.16, 1, 0.3, 1)`, motion-safe only). Decorative; the count is carried by its accessible label.

### Logo
A contour tulip tea glass on a saucer: navy outline, ruby tea, porcelain background. Raster files only: `frontend/src/assets/app-logo.png` (192px) in the app, and `frontend/public/favicon.png` (48px) and `apple-touch-icon.png` (180px) for the browser, both linked from `frontend/index.html`. The logo appears in the loading rings (start-up and phrase loading), at 40px beside the wordmark in the desktop header (where it replaced a speech-bubble line icon) and at 38px in the landing header. The Android launcher icons under `frontend/android` are not this logo yet.

### Landing Hero
The landing page (`frontend/src/LandingPage.tsx`, `frontend/src/landing.css`) opens with a full-width illustration, `frontend/public/landing/hero.webp`: a tulip glass of ruby tea on a saucer and a sesame simit on a pale ferry-deck table, a white railing and a red-and-white life ring behind, sea-teal water, gulls, and a low Istanbul skyline with a tower and minarets on the right. The left half is open sky and water, and the copy (eyebrow, heading, lead, sign-in action) sits over it in a column at most 520px wide. Up to 700px wide the image is shown above the copy at 4:3 instead. The image has alternative text in Russian and English. There is no phone screenshot in the hero; three screenshots (topics, practice, feedback) remain in the steps section.

The illustration is a generated image. Its prompt is not kept in git; in summary it asked for a wide flat editorial illustration with no text, people, logos or flags, the tea and simit in the right third, the left half kept empty for a headline, and a palette of porcelain cream, pale sky blue, sea teal and deep navy with ruby red as the only strong accent.

Landing headings (h1, h2) and the brand name use the display face (Alegreya Sans 700). The colors of the rendered landing page come from the tokens, directly or through the legacy variable names (`--blue` is the accent, `--text` the ink, `--line` the hairline).

## Do's and Don'ts

### Do:
- **Do** use only the tokens in `frontend/src/shared/styles/tokens.css` through Tailwind utilities (bg-surface, text-ink-muted, rounded-card).
- **Do** keep exactly one ruby-filled control per state, and put a visible word on every action except the microphone disc.
- **Do** set the phrase in Alegreya Sans at 1.875rem (2.25rem from 640px) and Turkish answers in system sans at 1.25rem.
- **Do** show limits and pauses as sea-teal notices with a reason and a resume time.
- **Do** mark mistakes in raspberry and keep ruby for actions and hints.
- **Do** keep touch targets at least 44px and give every interactive element the 2px sea-teal focus ring.
- **Do** gate decorative motion (tea fill, recording ping) behind `prefers-reduced-motion`.

### Don't:
- **Don't** copy colors, glows or radii from the legacy stylesheet (`frontend/src/styles.css`); it is not part of this system.
- **Don't** add colored or zero-offset glows to buttons, icons or medals.
- **Don't** use raspberry for limits, pauses or neutral information.
- **Don't** use ruby for errors or mistakes, and don't add a second ruby-filled control to a state.
- **Don't** bring back the dark ground, walnut surfaces or amber accent of the earlier world.
- **Don't** use the verdict colors as decoration.
- **Don't** add uppercase tracked labels above headings.
- **Don't** hide the fix: the review list is expanded and the score stays on screen after any reward animation.
