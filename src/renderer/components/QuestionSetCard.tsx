import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import type { QuestionItem, QuestionSet } from "../../shared/types";

interface QuestionSetCardProps {
  questionSet: QuestionSet;
  onSend: (content: string) => void;
}

type Answers = Record<string, string>;

export function QuestionSetCard({ questionSet, onSend }: QuestionSetCardProps) {
  const [answers, setAnswers] = useState<Answers>(() => createRecommendedAnswers(questionSet.questions));
  const [customAnswers, setCustomAnswers] = useState<Answers>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const canSubmit = !hasSubmitted && questionSet.questions.every((question) => answers[question.id]?.trim() || customAnswers[question.id]?.trim());

  const answeredCount = useMemo(
    () => questionSet.questions.filter((question) => answers[question.id]?.trim() || customAnswers[question.id]?.trim()).length,
    [answers, customAnswers, questionSet.questions]
  );

  const submit = () => {
    if (!canSubmit) {
      return;
    }

    const lines = questionSet.questions.map((question) => {
      const custom = customAnswers[question.id]?.trim();
      const answer = custom || answers[question.id]?.trim() || "No answer";
      return `- ${question.question}: ${answer}`;
    });

    onSend(["Answers to your questions:", ...lines].join("\n"));
    setHasSubmitted(true);
  };

  return (
    <section className="question-set-card">
      <div className="question-set-header">
        <div>
          <h3>{questionSet.title || "Let me know"}</h3>
          <p>Choose the best answer or write your own.</p>
        </div>
        <span>
          {answeredCount}/{questionSet.questions.length}
        </span>
      </div>

      <div className="question-list">
        {questionSet.questions.map((question) => (
          <QuestionBlock
            key={question.id}
            question={question}
            selectedAnswer={answers[question.id] ?? ""}
            customAnswer={customAnswers[question.id] ?? ""}
            disabled={hasSubmitted}
            onCustomAnswer={(value) => {
              setCustomAnswers((current) => ({ ...current, [question.id]: value }));
              if (value.trim()) {
                setAnswers((current) => ({ ...current, [question.id]: "" }));
              }
            }}
            onSelect={(value) => {
              setAnswers((current) => ({ ...current, [question.id]: value }));
              setCustomAnswers((current) => ({ ...current, [question.id]: "" }));
            }}
          />
        ))}
      </div>

      <button className="question-submit" type="button" disabled={!canSubmit} onClick={submit}>
        <span>{hasSubmitted ? "Sent answers" : "Send answers"}</span>
      </button>
    </section>
  );
}

interface QuestionBlockProps {
  question: QuestionItem;
  selectedAnswer: string;
  customAnswer: string;
  disabled: boolean;
  onCustomAnswer: (value: string) => void;
  onSelect: (value: string) => void;
}

function QuestionBlock({ question, selectedAnswer, customAnswer, disabled, onCustomAnswer, onSelect }: QuestionBlockProps) {
  return (
    <section className="question-block">
      <h4>{question.question}</h4>
      <div className="question-options">
        {question.options.map((option) => (
          <button
            className={selectedAnswer === option.label ? "question-option selected" : "question-option"}
            type="button"
            disabled={disabled}
            key={option.id}
            onClick={() => onSelect(option.label)}
          >
            <span>{option.label}</span>
            {option.recommended ? <small>Recommended</small> : null}
            {selectedAnswer === option.label ? <Check size={14} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
      <input
        className="question-custom-input"
        value={customAnswer}
        disabled={disabled}
        onChange={(event) => onCustomAnswer(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        placeholder={question.customPlaceholder || "Write what you want"}
      />
    </section>
  );
}

function createRecommendedAnswers(questions: QuestionItem[]): Answers {
  return questions.reduce<Answers>((current, question) => {
    const recommended = question.options.find((option) => option.recommended) ?? question.options[0];

    if (recommended) {
      current[question.id] = recommended.label;
    }

    return current;
  }, {});
}
