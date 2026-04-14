import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { isMongoConnected } from '../config/db.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';

function getBearerToken(headerValue) {
  if (!headerValue || !headerValue.startsWith('Bearer ')) {
    return null;
  }

  return headerValue.slice(7).trim();
}

export function signAuthToken(user) {
  if (!env.jwtSecret) {
    throw new HttpError(500, 'JWT_SECRET is missing on the server.');
  }

  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  if (!isMongoConnected()) {
    throw new HttpError(503, 'MongoDB not connected.');
  }

  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    throw new HttpError(401, 'Authorization token missing.');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new HttpError(401, 'Invalid or expired token.');
  }

  const user = await User.findById(payload.sub).select('_id name email');
  if (!user) {
    throw new HttpError(401, 'User account no longer exists.');
  }

  req.user = user;
  next();
});

export const attachUserIfPresent = asyncHandler(async (req, _res, next) => {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    return next();
  }

  if (!isMongoConnected()) {
    throw new HttpError(503, 'MongoDB not connected.');
  }

  if (!env.jwtSecret) {
    throw new HttpError(500, 'JWT_SECRET is missing on the server.');
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).select('_id name email');

    if (user) {
      req.user = user;
    }
  } catch {
    req.user = null;
  }

  return next();
});
