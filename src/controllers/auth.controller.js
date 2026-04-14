import bcrypt from 'bcrypt';

import { isMongoConnected } from '../config/db.js';
import User from '../models/User.js';
import { signAuthToken } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { cleanText } from '../utils/funnel.js';
import { HttpError } from '../utils/http-error.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ensureMongoReady() {
  if (!isMongoConnected()) {
    throw new HttpError(503, 'MongoDB not connected.');
  }
}

function validateCredentials({ name, email, password }, requireName = false) {
  const safeName = cleanText(name, '', 80);
  const safeEmail = cleanText(email, '', 160).toLowerCase();
  const safePassword = typeof password === 'string' ? password : '';

  if (requireName && safeName.length < 2) {
    throw new HttpError(400, 'Name must be at least 2 characters long.');
  }

  if (!EMAIL_REGEX.test(safeEmail)) {
    throw new HttpError(400, 'A valid email address is required.');
  }

  if (safePassword.trim().length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters long.');
  }

  return {
    name: safeName,
    email: safeEmail,
    password: safePassword
  };
}

function buildAuthResponse(user) {
  return {
    token: signAuthToken(user),
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email
    }
  };
}

export const register = asyncHandler(async (req, res) => {
  ensureMongoReady();

  const { name, email, password } = validateCredentials(req.body, true);
  const existingUser = await User.findOne({ email }).select('_id');

  if (existingUser) {
    throw new HttpError(409, 'An account with this email already exists.');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, password: hashedPassword });

  res.status(201).json({
    success: true,
    message: 'User registered successfully.',
    ...buildAuthResponse(user)
  });
});

export const login = asyncHandler(async (req, res) => {
  ensureMongoReady();

  const { email, password } = validateCredentials(req.body, false);
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  res.json({
    success: true,
    message: 'Login successful.',
    ...buildAuthResponse(user)
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id.toString(),
      name: req.user.name,
      email: req.user.email
    }
  });
});
