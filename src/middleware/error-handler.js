import { HttpError } from '../utils/http-error.js';

export function errorHandler(err, _req, res, _next) {
  let statusCode = err instanceof HttpError ? err.statusCode : 500;
  let message = err.message || 'Unexpected server error.';

  if (err?.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((entry) => entry.message).join(' ');
  }

  if (err?.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid input.';
  }

  if (err?.code === 11000) {
    statusCode = 409;
    message = 'A record with that value already exists.';
  }

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    details: err instanceof HttpError ? err.details : undefined
  });
}
