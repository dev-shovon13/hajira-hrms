export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, code = 'BAD_REQUEST', errors?: Record<string, string[]>) {
    return new AppError(400, message, code, errors);
  }
  static unauthorized(message = 'Please sign in to continue', code = 'UNAUTHORIZED') {
    return new AppError(401, message, code);
  }
  static forbidden(message = 'You do not have permission to do that', code = 'FORBIDDEN') {
    return new AppError(403, message, code);
  }
  static notFound(what = 'Resource') {
    return new AppError(404, `${what} not found`, 'NOT_FOUND');
  }
  static conflict(message: string, code = 'CONFLICT') {
    return new AppError(409, message, code);
  }
  static unprocessable(message: string, code = 'UNPROCESSABLE', errors?: Record<string, string[]>) {
    return new AppError(422, message, code, errors);
  }
}
