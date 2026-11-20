# ADR-0004: Standard Turkish, Latin alphabet, Russian and English as source languages

- Status: Accepted
- Date: 2026-11-20
- Decided by: product owner

## Context
The inherited app taught Serbian with two alphabets and a dialect policy (Ekavian only). Turkish has one alphabet and different casing rules.

## Decision
- Target language: standard (Istanbul) Turkish at A2.
- One alphabet; the Latin/Cyrillic toggle and the dialect policy are removed.
- Comparison and casing use Turkish rules: `İ` lowercases to `i`, `I` to `ı`. Circumflex vowels (â î û) are accepted with or without the circumflex.
- Source and interface languages stay Russian (default) and English.
- Stored field names use the suffix `_tr` where they used `_sr`.

## Alternatives considered
- Language-neutral field names (`_target`): cleaner for a multi-language future, but the product is single-language and the existing `_ru` / `_en` naming is language-specific already.
- English only: simpler content, loses the Russian-speaking audience.

## Consequences
- The 210 preset phrases, hints and the skill catalogue are re-authored for Turkish and need review by a native speaker before public launch.
- Generic lowercasing functions must not be used on Turkish text; the text policy module is the single place for it.
