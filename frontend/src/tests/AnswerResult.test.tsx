import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AnswerResult } from "../AnswerResult";
import type { Attempt } from "../types/training";
import { setLanguage } from "../i18n";

const attempt: Attempt = {
  id: "attempt-1",
  exercise_id: "exercise-1",
  transcript_tr: "Račun želim otovrim.",
  overall_score: 0.5,
  base_score: 0.5,
  hint_penalty: 0,
  analysis: {
    verdict: "needs_work",
    semantic_score: 0.5,
    grammar_score: 0.5,
    lexical_score: 0.5,
    naturalness_score: 0.5,
    pronunciation_score: null,
    fluency_score: 1,
    corrected_tr: "Želim otvorim račun.",
    short_feedback_ru: "Исправьте ответ.",
    detailed_feedback_ru: "Исправьте порядок и написание.",
    accepted_alternatives: [],
    issues: [{ type: "vocabulary", skill_key: "vocabulary", severity: 0.8, confidence: 0.9, evidence: "otovrim", correction: "otvorim" }],
    demonstrated_skills: [],
  },
};

describe("AnswerResult", () => {
  afterEach(() => {
    cleanup();
    setLanguage("ru");
  });
  for (const language of ["ru", "en"] as const) {
    it(`marks errors without a curriculum skill (${language})`, () => {
      setLanguage(language);
      const issue = { ...attempt.analysis.issues[0], skill_key: null, evidence: "otovrim", correction: "otvorim" };
      render(<AnswerResult answer={attempt.transcript_tr} attempt={{ ...attempt, analysis: { ...attempt.analysis, issues: [issue], demonstrated_skills: [] } }} />);
      const marks = document.querySelectorAll("mark");
      expect(marks).toHaveLength(1);
      expect(marks[0]).toHaveTextContent("otovrim");
      expect(marks[0]).toHaveAttribute("title", "otvorim");
      expect(document.querySelector(".result-phrase__text")).toHaveTextContent(attempt.transcript_tr);
    });

    it(`preserves unreported Da and marks the reported word order (${language})`, () => {
      setLanguage(language);
      const answer = "Sednemo Napolju. Da, naravno. Baš lepo je vreme.";
      const issues = [
        { ...attempt.analysis.issues[0], evidence: "Sednemo", correction: "Da sednemo" },
        { ...attempt.analysis.issues[0], evidence: "Baš lepo je", correction: "baš je lepo" },
      ];
      render(
        <AnswerResult
          answer={answer}
          attempt={{
            ...attempt,
            analysis: {
              ...attempt.analysis,
              corrected_tr: "Da sednemo napolju? — Može, naravno, baš je lepo vreme.",
              issues,
            },
          }}
        />,
      );
      expect(Array.from(document.querySelectorAll("mark"), mark => mark.textContent)).toEqual(["lepo", "je"]);
      expect(document.querySelector(".result-phrase__text")).toHaveTextContent(answer);
    });

    it(`marks Da when analysis explicitly reports Da → Može (${language})`, () => {
      setLanguage(language);
      const issues = [{ ...attempt.analysis.issues[0], evidence: "Da", correction: "Može" }];
      render(<AnswerResult answer="Sednemo Napolju. Da, naravno. Baš lepo je vreme." attempt={{ ...attempt, analysis: { ...attempt.analysis, issues } }} />);
      const marks = document.querySelectorAll("mark");
      expect(marks).toHaveLength(1);
      expect(marks[0]).toHaveTextContent("Da");
      expect(marks[0]).toHaveAttribute("title", "Može");
    });
  }
  it("finds evidence with Turkish dotted and dotless capitals", () => {
    const issues = [{ ...attempt.analysis.issues[0], evidence: "istanbul'a", correction: "İzmir'e" }];
    render(<AnswerResult answer="İstanbul'a yarın gidiyorum." attempt={{ ...attempt, analysis: { ...attempt.analysis, issues } }} />);
    // Found despite İ/i: the marks cover only the changed parts of "İstanbul'a", never other words.
    const marked = Array.from(document.querySelectorAll("mark"), mark => mark.textContent ?? "");
    expect(marked.length).toBeGreaterThan(0);
    expect(marked.every(part => "İstanbul'a".includes(part))).toBe(true);
    expect(screen.getByText("Ваш вариант").parentElement).toHaveTextContent("İstanbul'a yarın gidiyorum.");
  });

  it("marks only evidence explicitly reported in validated analysis", () => {
    render(<AnswerResult answer={attempt.transcript_tr} attempt={attempt} />);
    expect(screen.queryByText("Фраза на русском")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".result-phrase")).toHaveLength(2);
    const userRow = screen.getByText("Ваш вариант").parentElement as HTMLElement;
    expect(within(userRow).getByText("otovrim")).toHaveClass("answer-mark--issue");
    expect(within(userRow).getByText("otovrim")).toHaveAttribute("title", "otvorim");
    expect(within(userRow).queryByText("Račun")).not.toBeInTheDocument();
    expect(userRow).toHaveTextContent("Račun želim otovrim.");
    expect(screen.getByText("Želim otvorim račun.")).toBeInTheDocument();
  });

  it("does not mark accepted correct wording against the canonical phrase", () => {
    render(<AnswerResult answer="Mogu da otvorim račun." attempt={{ ...attempt, analysis: { ...attempt.analysis, verdict: "correct" } }} />);
    expect(document.querySelector("mark")).not.toBeInTheDocument();
    expect(screen.getByText("Вариант перевода")).toBeInTheDocument();
  });

  it("marks only the changed word inside a multiword evidence phrase", () => {
    const answer = "Nemam jutreneg prevoza danas.";
    const issue = { ...attempt.analysis.issues[0], evidence: "jutreneg prevoza", correction: "jutarnjeg prevoza" };
    render(<AnswerResult answer={answer} attempt={{ ...attempt, analysis: { ...attempt.analysis, issues: [issue] } }} />);
    const marks = document.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("jutreneg");
    expect(screen.getByText("Ваш вариант").parentElement).toHaveTextContent(answer);
  });

  it("marks reordered and removed words, leaving unchanged words and pure insertions unmarked", () => {
    const issues = [
      { ...attempt.analysis.issues[0], evidence: "račun otvorim", correction: "otvorim račun" },
      { ...attempt.analysis.issues[0], evidence: "baš da idem", correction: "da idem" },
      { ...attempt.analysis.issues[0], evidence: "želim kući", correction: "želim da idem kući" },
    ];
    render(<AnswerResult answer="račun otvorim, baš da idem; želim kući." attempt={{ ...attempt, analysis: { ...attempt.analysis, issues } }} />);
    expect(Array.from(document.querySelectorAll("mark"), mark => mark.textContent)).toEqual(["račun", "otvorim", "baš"]);
  });

  it("leaves repeated words unmarked when their alignment is ambiguous", () => {
    const issue = { ...attempt.analysis.issues[0], evidence: "da da idem", correction: "da idem" };
    render(<AnswerResult answer="da da idem" attempt={{ ...attempt, analysis: { ...attempt.analysis, issues: [issue] } }} />);
    expect(document.querySelector("mark")).not.toBeInTheDocument();
  });

  it("does not mark ambiguous repeated text or a word fragment", () => {
    const answer = "račun račun računar";
    const issues = [
      { ...attempt.analysis.issues[0], evidence: "račun" },
      { ...attempt.analysis.issues[0], evidence: "rač" },
    ];
    render(<AnswerResult answer={answer} attempt={{ ...attempt, analysis: { ...attempt.analysis, issues } }} />);
    expect(document.querySelector("mark")).not.toBeInTheDocument();
  });

  it("does not mark equivalent Unicode or case variants, but retains a real extra letter", () => {
    const answer = "Teşekku\u0308rler. Kahvve lütfen.";
    const issues = [
      { ...attempt.analysis.issues[0], evidence: "Teşekkürler", correction: "TEŞEKKÜRLER" },
      { ...attempt.analysis.issues[0], evidence: "Kahvve", correction: "Kahve" },
    ];
    render(<AnswerResult answer={answer} attempt={{ ...attempt, analysis: { ...attempt.analysis, issues } }} />);
    const marks = document.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("Kahvve");
    expect(screen.getByText("Ваш вариант").parentElement).toHaveTextContent("Teşekkürler. Kahvve lütfen.");
  });
});
