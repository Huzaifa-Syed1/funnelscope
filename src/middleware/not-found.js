import { HttpError } from '../utils/http-error.js';

export function notFound(_req, _res, next) {
  next(new HttpError(404, 'The requested resource was not found.'));
}
