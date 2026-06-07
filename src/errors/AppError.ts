export type AppErrorCode =
  | "USER_NOT_FOUND"
  | "USER_BLOCKED"
  | "SUBMISSION_NOT_FOUND"
  | "SUBMISSION_NOT_ELIGIBLE"
  | "DUPLICATE_VOTE"
  | "DUPLICATE_SUBMISSION"
  | "INVALID_PHASE"
  | "EPOCH_NOT_FOUND"
  | "UNAUTHORIZED_ADMIN"
  | "ALREADY_FLAGGED"
  | "DAILY_POST_LIMIT"
  | "SELF_VOTE"
  | "INVALID_INPUT";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;

  constructor(code: AppErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function assertNotBlocked(isBlocked: boolean, context: string): void {
  if (isBlocked) {
    throw new AppError(
      "USER_BLOCKED",
      `Blocked user cannot perform action: ${context}`,
      403,
    );
  }
}
