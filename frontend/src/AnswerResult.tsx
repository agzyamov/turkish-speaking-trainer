import { t } from "./i18n";
import type { Attempt } from "./types/training";
import { latinForEvaluation } from "./turkishText";

type MarkedRange = { start: number; end: number; explanation: string };
type Word = { start: number; end: number; normalized: string };

function words(text: string): Word[] {
  return Array.from(text.matchAll(/[\p{L}\p{N}]+/gu), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
    normalized: match[0].toLocaleLowerCase("tr"),
  }));
}

function changedWords(evidence: string, correction: string): Word[] {
  const before = words(evidence);
  const after = words(correction);
  if (!before.length || before.length > 64 || after.length > 64) return [];

  // A repeated word can have several equally plausible alignments. Leave it unmarked.
  if (new Set(before.map((word) => word.normalized)).size !== before.length ||
      new Set(after.map((word) => word.normalized)).size !== after.length) return [];

  const beforeSet = before.map((word) => word.normalized).sort();
  const afterSet = after.map((word) => word.normalized).sort();
  if (before.length === after.length && beforeSet.every((word, index) => word === afterSet[index])) {
    return before.filter((word, index) => word.normalized !== after[index].normalized);
  }

  type Alignment = { edits: number; matches: number };
  const best: Alignment[][] = Array.from({ length: before.length + 1 }, () =>
    Array.from({ length: after.length + 1 }, () => ({ edits: 0, matches: 0 })));
  for (let i = before.length; i >= 0; i--) {
    for (let j = after.length; j >= 0; j--) {
      if (i === before.length && j === after.length) continue;
      const choices: Alignment[] = [];
      if (i < before.length && j < after.length) {
        const next = best[i + 1][j + 1];
        const equal = before[i].normalized === after[j].normalized;
        choices.push({ edits: next.edits + (equal ? 0 : 1), matches: next.matches + (equal ? 1 : 0) });
      }
      if (i < before.length) choices.push({ edits: best[i + 1][j].edits + 1, matches: best[i + 1][j].matches });
      if (j < after.length) choices.push({ edits: best[i][j + 1].edits + 1, matches: best[i][j + 1].matches });
      best[i][j] = choices.reduce((left, right) =>
        right.edits < left.edits || (right.edits === left.edits && right.matches > left.matches) ? right : left);
    }
  }

  const changed: Word[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    const target = best[i][j];
    if (i < before.length && j < after.length) {
      const equal = before[i].normalized === after[j].normalized;
      const next = best[i + 1][j + 1];
      if (target.edits === next.edits + (equal ? 0 : 1) && target.matches === next.matches + (equal ? 1 : 0)) {
        if (!equal) changed.push(before[i]);
        i++; j++;
        continue;
      }
    }
    if (i < before.length && target.edits === best[i + 1][j].edits + 1 && target.matches === best[i + 1][j].matches) {
      changed.push(before[i++]);
    } else {
      j++;
    }
  }
  return changed;
}

function evidenceRanges(answer: string, attempt: Attempt): MarkedRange[] {
  if (attempt.analysis.verdict === "correct") return [];
  const ranges: MarkedRange[] = [];
  const lowerAnswer = answer.toLocaleLowerCase("tr");
  const isWord = (character: string | undefined) => Boolean(character && /[\p{L}\p{N}]/u.test(character));
  for (const issue of attempt.analysis.issues) {
    if (issue.severity <= 0) continue;
    const evidence = latinForEvaluation(issue.evidence.trim());
    if (!evidence) continue;
    const correction = issue.correction ? latinForEvaluation(issue.correction.trim()) : undefined;
    if (correction && evidence.toLocaleLowerCase("tr") === correction.toLocaleLowerCase("tr")) continue;
    const start = lowerAnswer.indexOf(evidence.toLocaleLowerCase("tr"));
    const end = start + evidence.length;
    if (start < 0 || lowerAnswer.indexOf(evidence.toLocaleLowerCase("tr"), end) >= 0) continue;
    if ((isWord(evidence[0]) && isWord(answer[start - 1])) || (isWord(evidence.at(-1)) && isWord(answer[end]))) continue;
    if (answer.slice(start, end).toLocaleLowerCase("tr") !== evidence.toLocaleLowerCase("tr")) continue;
    const parts = correction ? changedWords(evidence, correction) : [{ start: 0, end: evidence.length }];
    if (parts.some((part) => ranges.some((range) => start + part.start < range.end && start + part.end > range.start))) continue;
    ranges.push(...parts.map((part) => ({ start: start + part.start, end: start + part.end, explanation: issue.correction ?? issue.evidence })));
  }
  return ranges.sort((left, right) => left.start - right.start);
}

function HighlightedAnswer({ answer, attempt }: { answer: string; attempt: Attempt }) {
  const latinAnswer = latinForEvaluation(answer);
  const ranges = evidenceRanges(latinAnswer, attempt);
  const content: React.ReactNode[] = [];
  let cursor = 0;
  for (const [index, range] of ranges.entries()) {
    if (cursor < range.start) content.push(<span key={`text-${index}`}>{latinAnswer.slice(cursor, range.start)}</span>);
    content.push(<mark className="answer-mark answer-mark--issue rounded-sm bg-danger/20 px-0.5 text-ink underline decoration-danger decoration-2 underline-offset-4" title={range.explanation} key={`issue-${index}`}>{latinAnswer.slice(range.start, range.end)}</mark>);
    cursor = range.end;
  }
  content.push(<span key="tail">{latinAnswer.slice(cursor)}</span>);
  return <span className="result-phrase__text text-answer text-ink" lang="tr">{content}</span>;
}

const resultBox = "result-phrase grid gap-1.5 rounded-control border p-4";
const resultLabel = "text-caption font-semibold";

export function AnswerResult({ answer, attempt }: { answer: string; attempt: Attempt }) {
  return <div className="result-phrases grid gap-3">
    <div className={`${resultBox} border-line bg-surface-raised`}><small className={`${resultLabel} text-ink-muted`}>{t("Ваш вариант")}</small><HighlightedAnswer answer={answer} attempt={attempt} /></div>
    <div className={`${resultBox} correction border-success/35 bg-success/8`}><small className={`${resultLabel} text-success`}>{t(attempt.analysis.verdict === "correct" ? "Вариант перевода" : "Правильный вариант")}</small><span className="result-phrase__text text-answer text-ink" lang="tr">{latinForEvaluation(attempt.analysis.corrected_tr)}</span></div>
  </div>;
}
