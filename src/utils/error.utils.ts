type Issue = {
  code: string;
  message: string;
  path?: string;
  expected?: string;
};

export class TkrAppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string,
    public issues: Issue[] = [],
  ) {
    super(message);
    this.name = "TkrAppError";
  }
}

export class ValidationError extends TkrAppError {
  constructor(message: string, issues: Issue[] = []) {
    super(400, message, "VALIDATION_ERROR", issues);
  }
}

export class NotFoundError extends TkrAppError {
  constructor(message: string) {
    super(404, message, "NOT_FOUND");
  }
}

export class UnauthorizedError extends TkrAppError {
  constructor(message: string) {
    super(403, message, "UNAUTHORIZED");
  }
}

export class ConflictError extends TkrAppError {
  constructor(message: string) {
    super(409, message, "CONFLICT");
  }
}
