import { submissionAttemptSchema, type SubmissionAttempt } from './contracts';

const STORAGE_KEY = 'biud:submission-attempt';

export function saveAttempt(attempt: SubmissionAttempt): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
  } catch {
    // storage unavailable — attempt lives in memory only
  }
}

export function loadAttempt(): SubmissionAttempt | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const result = submissionAttemptSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function clearAttempt(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable
  }
}
