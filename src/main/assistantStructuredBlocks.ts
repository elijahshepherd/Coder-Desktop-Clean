import type {
  ProviderError,
  ProviderId,
  QuestionItem,
  QuestionOption,
  QuestionSet,
  TodoProgress,
  TodoProgressItem,
  TodoProgressStatus
} from "../shared/types";

const maxProgressItems = 12;
const maxQuestions = 5;
const maxOptions = 3;

export interface ParsedStructuredBlocks {
  progress: TodoProgress[];
  providerErrors: ProviderError[];
  questionSets: QuestionSet[];
  hadBlocks: boolean;
}

export function parseAssistantStructuredBlocks(content: string): ParsedStructuredBlocks {
  const progress = parseTodoProgressBlocks(content);
  const providerErrors = parseProviderErrorBlocks(content);
  const questionSets = parseQuestionSetBlocks(content);

  return {
    progress,
    providerErrors,
    questionSets,
    hadBlocks: progress.length > 0 || providerErrors.length > 0 || questionSets.length > 0
  };
}

export function stripAssistantStructuredBlocks(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/<coder-progress>[\s\S]*?<\/coder-progress>/gi, "")
    .replace(/<coder-provider-error>[\s\S]*?<\/coder-provider-error>/gi, "")
    .replace(/<coder-questions>[\s\S]*?<\/coder-questions>/gi, "")
    .replace(/<coding-questions>[\s\S]*?<\/coding-questions>/gi, "")
    .trim();
}

export function parseTodoProgressBlocks(content: string): TodoProgress[] {
  const matches = content.matchAll(/<coder-progress>\s*({[\s\S]*?})\s*<\/coder-progress>/gi);
  const blocks: TodoProgress[] = [];

  for (const match of matches) {
    try {
      const parsed = normalizeTodoProgress(JSON.parse(match[1]) as Record<string, unknown>);

      if (parsed) {
        blocks.push(parsed);
      }
    } catch {
      continue;
    }
  }

  return blocks;
}

export function parseQuestionSetBlocks(content: string): QuestionSet[] {
  const matches = content.matchAll(/<(?:coder|coding)-questions>\s*({[\s\S]*?})\s*<\/(?:coder|coding)-questions>/gi);
  const blocks: QuestionSet[] = [];

  for (const match of matches) {
    try {
      const parsed = normalizeQuestionSet(JSON.parse(match[1]) as Record<string, unknown>);

      if (parsed) {
        blocks.push(parsed);
      }
    } catch {
      continue;
    }
  }

  return blocks;
}

export function parseProviderErrorBlocks(content: string): ProviderError[] {
  const matches = content.matchAll(/<coder-provider-error>\s*({[\s\S]*?})\s*<\/coder-provider-error>/gi);
  const blocks: ProviderError[] = [];

  for (const match of matches) {
    try {
      const parsed = normalizeProviderError(JSON.parse(match[1]) as Record<string, unknown>, blocks.length);

      if (parsed) {
        blocks.push(parsed);
      }
    } catch {
      continue;
    }
  }

  return blocks;
}

function normalizeTodoProgress(input: Record<string, unknown>): TodoProgress | null {
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const items = rawItems.map(normalizeTodoProgressItem).filter((item): item is TodoProgressItem => Boolean(item));

  if (items.length === 0) {
    return null;
  }

  return {
    id: sanitizeToken(input.id, "progress"),
    title: sanitizeText(input.title, "Current task", 80),
    items: items.slice(0, maxProgressItems),
    updatedAt: new Date().toISOString()
  };
}

function normalizeTodoProgressItem(input: unknown, index: number): TodoProgressItem | null {
  if (!isRecord(input)) {
    return null;
  }

  const title = sanitizeText(input.title, "", 120);

  if (!title) {
    return null;
  }

  return {
    id: sanitizeToken(input.id, `task-${index + 1}`),
    title,
    status: readTodoStatus(input.status)
  };
}

function normalizeQuestionSet(input: Record<string, unknown>): QuestionSet | null {
  const rawQuestions = Array.isArray(input.questions) ? input.questions : [];
  const questions = rawQuestions.map(normalizeQuestionItem).filter((item): item is QuestionItem => Boolean(item));

  if (questions.length === 0) {
    return null;
  }

  return {
    id: sanitizeToken(input.id, "questions"),
    title: sanitizeText(input.title, "Let me know", 80),
    questions: questions.slice(0, maxQuestions),
    createdAt: new Date().toISOString()
  };
}

function normalizeProviderError(input: Record<string, unknown>, index: number): ProviderError | null {
  const provider = readProviderId(input.provider);
  const message = sanitizeText(input.message, "", 900);

  if (!provider || !message) {
    return null;
  }

  return {
    id: sanitizeToken(input.id, `provider-error-${index + 1}`),
    provider,
    providerLabel: sanitizeText(input.providerLabel, provider, 80),
    model: sanitizeText(input.model, "", 160) || undefined,
    title: sanitizeText(input.title, "Provider request failed", 120),
    message,
    statusCode: readStatusCode(input.statusCode),
    createdAt: new Date().toISOString()
  };
}

function normalizeQuestionItem(input: unknown, index: number): QuestionItem | null {
  if (!isRecord(input)) {
    return null;
  }

  const question = sanitizeText(input.question, "", 180);

  if (!question) {
    return null;
  }

  const rawOptions = Array.isArray(input.options) ? input.options : [];
  let options = rawOptions.map(normalizeQuestionOption).filter((item): item is QuestionOption => Boolean(item)).slice(0, maxOptions);

  if (options.length === 0) {
    options = [
      { id: "recommended", label: "Use the recommended choice", recommended: true },
      { id: "custom", label: "Let me write it" }
    ];
  }

  if (!options.some((option) => option.recommended)) {
    options = [{ ...options[0], recommended: true }, ...options.slice(1)];
  }

  return {
    id: sanitizeToken(input.id, `question-${index + 1}`),
    question,
    options,
    customPlaceholder: sanitizeText(input.customPlaceholder, "Write what you want", 90)
  };
}

function normalizeQuestionOption(input: unknown, index: number): QuestionOption | null {
  if (!isRecord(input)) {
    return null;
  }

  const label = sanitizeText(input.label, "", 120);

  if (!label) {
    return null;
  }

  return {
    id: sanitizeToken(input.id, `option-${index + 1}`),
    label,
    recommended: input.recommended === true
  };
}

function readTodoStatus(value: unknown): TodoProgressStatus {
  return value === "active" || value === "done" || value === "pending" ? value : "pending";
}

function readProviderId(value: unknown): ProviderId | null {
  return value === "openai" || value === "claude" || value === "nvidia" ? value : null;
}

function readStatusCode(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sanitizeText(value: unknown, fallback: string, maxLength: number): string {
  const text = typeof value === "string" ? value.replace(/\0/g, "").replace(/\s+/g, " ").trim() : fallback;
  return text.slice(0, maxLength);
}

function sanitizeToken(value: unknown, fallback: string): string {
  const text = sanitizeText(value, fallback, 80).toLowerCase();
  return text.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
