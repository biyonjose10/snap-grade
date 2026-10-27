// Shapes for one internal test and the scripts graded against it.

export interface Question {
  no: string; // "1", "2a"
  maxMarks: number;
  prompt: string; // the question as printed
  rubric: string; // the teacher's model answer / marking points
}

export interface TestPaper {
  title: string;
  questions: Question[];
}

// What Nemotron Super VL read from the pages, per question.
export interface Reading {
  questionNo: string;
  text: string;
  legibility: number; // 0..1, the model's own estimate
  present: boolean; // false if the student left it blank
}

// What Nemotron Ultra proposed, per question. Never final until the teacher approves.
export interface ProposedMark {
  questionNo: string;
  awarded: number;
  reason: string;
  confidence: number; // 0..1
}

export type FlagKind = "illegible" | "missing" | "over_max" | "low_confidence" | "not_read" | "extra_answer";

export interface Flag {
  questionNo: string | null;
  kind: FlagKind;
  message: string;
}

// The auditor's view: code-checked marks per question, totals and everything a teacher should look at.
export interface AuditedQuestion {
  questionNo: string;
  max: number;
  reading: Reading | null;
  proposed: number | null; // after clamping and rounding by code
  reason: string;
  flagged: boolean;
}

export interface Audit {
  questions: AuditedQuestion[];
  total: number;
  max: number;
  flags: Flag[];
}

export type StepId = "read" | "mark" | "audit";

export interface ModelCall {
  step: StepId;
  model: string;
  requestId: string | null;
  ms: number;
  promptTokens: number | null;
  completionTokens: number | null;
  cachedTokens: number | null;
  ok: boolean;
  error?: string;
}

export type GradeEvent =
  | { type: "step"; step: StepId; status: "running" | "done" | "failed"; actor: string; detail?: string }
  | { type: "model_call"; call: ModelCall }
  | { type: "readings"; readings: Reading[] }
  | { type: "audit"; audit: Audit }
  | { type: "error"; message: string }
  | { type: "done" };
