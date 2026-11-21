---
name: TurkTalk
description: A Turkish speaking trainer; one phrase at a time, like one glass of tea in an Istanbul tea house.
colors:
  strong-tea: "#120e0b"
  walnut: "#1d1712"
  walnut-raised: "#271f18"
  amber-selected: "rgb(227 137 58 / 0.16)"
  porcelain: "#f5ede3"
  porcelain-soft: "#dccdbb"
  steeped-taupe: "#a9967f"
  hairline: "rgb(236 200 158 / 0.16)"
  copper-line: "#c98a4b"
  tea-amber: "#e3893a"
  tea-amber-bright: "#f2a35a"
  amber-ink: "#1b0f05"
  focus-glow: "#ffcf8a"
  leaf-green: "#86c9a0"
  tulip-gold: "#e6b94f"
  pomegranate: "#f07a6a"
  bosphorus-blue: "#8cb8d8"
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
    backgroundColor: "{colors.tea-amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.tea-amber-bright}"
  button-secondary:
    backgroundColor: "{colors.walnut-raised}"
    textColor: "{colors.porcelain-soft}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "52px"
  button-secondary-hover:
    textColor: "{colors.porcelain}"
  button-danger:
    backgroundColor: "{colors.walnut}"
    textColor: "{colors.pomegranate}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "44px"
  mic-disc:
    backgroundColor: "{colors.tea-amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.full}"
    size: "72px"
  mic-disc-recording:
    backgroundColor: "{colors.pomegranate}"
    textColor: "{colors.amber-ink}"
  card:
    backgroundColor: "{colors.walnut}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.card}"
    padding: "20px"
  input-answer:
    backgroundColor: "{colors.walnut-raised}"
    textColor: "{colors.porcelain}"
    typography: "{typography.answer}"
    rounded: "{rounded.control}"
    padding: "16px"
  word-tooltip:
    backgroundColor: "{colors.walnut-raised}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  pause-notice:
    textColor: "{colors.porcelain}"
    rounded: "{rounded.card}"
    padding: "16px"
---

# Design System: TurkTalk

<!-- Scope: this system covers the screens migrated onto the Tailwind tokens (the app shell and topic chooser, the practice screen, Settings, and the shared/ui primitives). The legacy stylesheet (frontend/src/styles.css, loaded in the lower "legacy" cascade layer) still lays out statistics, premium, login and legal pages; its colours now resolve to these tokens, but its radii, sizes and class structure are not part of this system: do not copy them into new work. -->

## Overview

**Creative North Star: "One Glass of Tea"**

A practice session is one glass of tea in an Istanbul tea house in the evening: a strong-tea ground, warm walnut surfaces, porcelain-colored text, and tea held up to the light as the single accent. The screen is calm and holds one thing at a time: one phrase, one primary action, one result. Progress is literal: a small tulip tea glass in the top row fills phrase by phrase, and one session is one glass.

Density is low and phone-first. The phrase is the largest thing on screen and sits in a humanist display face. Everything else is plain system sans in porcelain and taupe tones. Color carries meaning, not decoration: amber means "act here" or "tap for a hint", and green, gold and pomegranate are kept for the verdict. A paused or limited state is calm Bosphorus blue information, never an error.

Depth is quiet. Surfaces are tonal steps of walnut separated by hairlines, and one soft shadow lifts only what floats or what should be pressed. Nothing glows. This world replaces the inherited dark-navy shell with its glowing icon discs.

**Key Characteristics:**
- Warm near-black tea ground, two walnut surface steps, porcelain ink.
- One amber accent: the primary action, hint words and the tea filling.
- Verdict colors (leaf green, tulip gold, pomegranate) used only for results and recording.
- Alegreya Sans for the phrase and the score numeral; system sans for everything else.
- Flat tonal surfaces with hairline borders; one soft lift shadow, no glow.
- Labelled, thumb-zone actions at least 44px tall (52px for the main action).

## Colors

A warm, low-light palette: tea, walnut and porcelain neutrals with one amber accent and a small set of semantic colors.

### Primary
- **Tea Amber** (tea-amber): the color of tea held up to the light. Fills the one primary action in each state (the microphone disc, "Check", "Next phrase"), the dotted underline of hint words, a used hint's text, the caret in the answer field and the liquid in the tea glass.
- **Bright Tea Amber** (tea-amber-bright): hover state of amber actions and hover text of hint words; also links in Settings.
- **Amber Ink** (amber-ink): text and icons on amber (and on the pomegranate recording disc).
- **Amber Selected** (amber-selected): tinted background of a selected option.

### Secondary
- **Tulip Gold** (tulip-gold): the gold rim of a tulip glass. The rim line on the tea glass, the "mostly correct" score, and the reward medal border.

### Tertiary
- **Leaf Green** (leaf-green): a correct score, the "Correct version" box label and border (at 35% border, 8% fill), and corrections in the review list.
- **Pomegranate** (pomegranate): marked mistakes (underline plus 20% tint on the learner's answer, struck-through evidence), the "needs work" score, the recording state of the microphone, script warnings and destructive buttons.
- **Bosphorus Blue** (bosphorus-blue): calm information. The AI-budget pause notice (40% border, 10% fill) and the transcript-assistance box (35% border, 8% fill).

### Neutral
- **Strong Tea** (strong-tea): the page ground and the focus-ring offset color on the canvas.
- **Walnut** (walnut): the main surface: practice card, Settings cards, focus-ring offset inside the card.
- **Raised Walnut** (walnut-raised): one step up: answer field, the learner's answer box, secondary buttons, tooltips, the empty part of the tea glass.
- **Porcelain** (porcelain): primary text, phrase, answers.
- **Soft Porcelain** (porcelain-soft): secondary text such as explanations, secondary button labels, the tea-glass outline.
- **Steeped Taupe** (steeped-taupe): muted text: topic name, captions, field labels, status line, placeholders.
- **Hairline** (hairline): the default 1px border on cards, fields and secondary controls.
- **Copper Line** (copper-line): the strong border: hover border of secondary controls, focused answer field, tooltip border, radio outlines.
- **Focus Glow** (focus-glow): the 2px focus ring and focus outline on every interactive element.

### Named Rules
**The One Amber Rule.** Each state of a screen has exactly one amber-filled control: the mic disc before an answer, "Check" with an answer, "Next" after the result. Everything else is walnut with a hairline.

**The Verdict Palette Rule.** Leaf green, tulip gold and pomegranate map to correct, mostly correct and needs work. They are not decorative colors and do not appear on neutral chrome.

**The Calm Limits Rule.** A spent budget, a pause or unavailable assistance is Bosphorus blue information with the reason and the resume time. Pomegranate is for mistakes the learner can fix, not for limits.

## Typography

**Display Font:** Alegreya Sans 400/500/700, self-hosted via Fontsource (with system-ui, Segoe UI, sans-serif)
**Body Font:** system-ui (with Segoe UI, Roboto, Arial, sans-serif)

**Character:** A warm humanist sans with calligraphic roots carries the phrase the learner must say; the platform's own sans does the quiet work around it. Alegreya Sans covers Cyrillic, Latin and the full Turkish alphabet (ç ğ ı İ ö ş ü).

### Hierarchy
- **Phrase** (500, 1.875rem, 1.22; 2.25rem / 1.2 from 640px): the source phrase in Russian or English, balanced wrapping. The largest text on the practice screen.
- **Score** (Alegreya Sans 700, 2.25rem, tabular numerals): the percentage in the verdict row, colored by verdict, followed by the verdict word in 1.125rem semibold porcelain.
- **Title** (700, 2rem, 1.2; compact 1.55rem in the Android layout): page headings such as Settings.
- **Answer** (400, 1.25rem, 1.45): anything in Turkish the learner reads or edits: the answer field, the learner's and the correct version, review corrections.
- **Body** (400, 0.875rem, normal leading): explanations, the voice status line, notices. Notice and section headings step up to 1rem semibold.
- **Label** (600, 0.8rem, 1.5): field and box labels ("Your answer", "Correct version"), sentence case. Captions use the same size at 400 in taupe.

### Named Rules
**The Phrase Voice Rule.** Alegreya Sans is used only for the phrase to be spoken and the score numeral. Turkish answers and all interface text stay in system sans.

**The Sentence Case Rule.** Labels are short sentence-case words in taupe or verdict color. No uppercase tracking, no label above a heading that repeats it.

## Layout

Phone first, one column. The practice screen is a vertical stack in three zones: a top row (topic name truncating on the left, tea glass on the right), a scrolling content area (phrase and hint legend, then the answer or the result), and a bottom control zone in the thumb area (mic disc and status line, or full-width labelled buttons). On the web the practice card is bounded to the viewport (`100dvh` minus the shell, minimum 32rem) so the controls stay on screen and the content scrolls; in the Android layout it fills the available height without its own border.

Spacing follows a 4px base: 8px between label and field, 12px between buttons and list items, 16px between form groups and inside boxes, 20px horizontal padding on phones and inside cards, 24px between content blocks, 32px horizontal padding from 640px. Settings uses a centered column capped at 980px with 16px gaps.

The single responsive step used is 640px (larger phrase, wider padding); the compact/Android variant is chosen by the app, not by a media query.

## Elevation & Depth

Flat by default, with tonal layering: strong-tea ground, walnut surface, raised walnut for things inside the surface, separated by 1px hairlines. One soft, neutral shadow lifts only what should feel pressable or floating.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 6px 18px rgb(0 0 0 / 0.38)`): the primary amber buttons, the microphone disc and the word-hint tooltip.

### Named Rules
**The Lift, Not Glow Rule.** Shadows are neutral black and soft. No colored or zero-offset glows around controls, medals or icons.

## Shapes

Two gentle radii: 10px for controls (buttons, fields, result boxes, tooltips) and 16px for containers (cards, the practice card, notices). Circles are kept for the microphone disc, switches and radios. Borders are 1px hairlines; a 2px pomegranate ring marks recording. Hint words are marked by a dotted 2px amber underline (offset 0.22em) that turns solid once used; mistakes by a solid 2px pomegranate underline. The one illustrative form is the tulip tea glass outline.

## Components

### Buttons
Labelled and calm: a word on every action, amber only for the main one.
- **Shape:** gently curved (10px).
- **Primary:** tea amber with amber ink, 16px semibold, lift shadow, at least 52px tall on the practice screen (44px in the shared Button). Full width in the control zone.
- **Hover / Focus:** hover brightens to bright tea amber over 150ms (`cubic-bezier(0.2, 0, 0, 1)`); focus is a 2px focus-glow ring offset 2px from the surface. Disabled drops to 55-60% opacity.
- **Secondary:** raised walnut (or walnut in the shared Button) with a hairline border and soft porcelain text; hover turns the border copper and the text porcelain. "Record again" pairs an icon with its word.
- **Danger:** walnut with pomegranate text and a 60% pomegranate border; hover makes the border solid.

### Microphone Disc
The one icon-only control: a 72px amber circle with a 30px line microphone and a lift shadow, in the thumb zone, with an accessible name. Presses scale to 95%. While recording it turns pomegranate with a 2px pomegranate ring that pings (motion-safe only); while connecting or transcribing it turns raised walnut.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** walnut.
- **Shadow Strategy:** none; see Elevation.
- **Border:** 1px hairline.
- **Internal Padding:** 20px, 16px gaps.

### Inputs / Fields
- **Style:** raised walnut, 1px hairline, 10px radius, 16px padding, answer type (1.25rem), amber caret, taupe placeholder, labelled above in the label style.
- **Focus:** border turns copper plus the focus-glow ring.
- **Read-only:** 80% opacity while checking.
- **Switch / Radio:** hairline-bordered raised walnut that fills amber when on or checked.

### Result Boxes
Two stacked 10px boxes: the learner's version on raised walnut with mistakes marked in pomegranate (20% tint and a 2px underline), and the correct version tinted leaf green (35% border, 8% fill) with a green label. Above them the verdict row (score, verdict word, hint penalty with a bulb icon); below, an always-expanded review list of evidence struck through in pomegranate, an arrow, the correction in green, and the explanation in soft porcelain.

### Word Hint
A tappable word in the phrase with a dotted amber underline and a 44px tap area. Tapping opens a tooltip below the word (above only when there is no room): raised walnut, copper border, 10px radius, lift shadow, the Turkish translation in 1rem medium. A used hint stays solid amber. A one-line caption under the phrase says that a hint lowers the score.

### Pause Notice
A 16px Bosphorus-blue tinted box with a 1rem semibold heading, the reason and resume time in soft porcelain, the typed-answer fallback, and the diagnostic code tucked behind a "More" disclosure.

### Tea Glass
Session progress as a 24x36 tulip-glass outline in soft porcelain with a tulip-gold rim; amber tea rises from the bottom as phrases are completed (700ms, `cubic-bezier(0.16, 1, 0.3, 1)`, motion-safe only). Decorative; the count is carried by its accessible label.

## Do's and Don'ts

### Do:
- **Do** use only the tokens in `frontend/src/shared/styles/tokens.css` through Tailwind utilities (bg-surface, text-ink-muted, rounded-card).
- **Do** keep exactly one amber-filled control per state, and put a visible word on every action except the microphone disc.
- **Do** set the phrase in Alegreya Sans at 1.875rem (2.25rem from 640px) and Turkish answers in system sans at 1.25rem.
- **Do** show limits and pauses as Bosphorus blue notices with a reason and a resume time.
- **Do** keep touch targets at least 44px and give every interactive element the 2px focus-glow ring.
- **Do** gate decorative motion (tea fill, recording ping) behind `prefers-reduced-motion`.

### Don't:
- **Don't** copy colors, glows or radii from the legacy stylesheet (`frontend/src/styles.css`); it is not part of this system.
- **Don't** add colored or zero-offset glows to buttons, icons or medals.
- **Don't** use pomegranate for limits, pauses or neutral information.
- **Don't** use the verdict colors as decoration.
- **Don't** add uppercase tracked labels above headings.
- **Don't** hide the fix: the review list is expanded and the score stays on screen after any reward animation.
