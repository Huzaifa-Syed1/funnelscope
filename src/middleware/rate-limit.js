import rateLimit from 'express-rate-limit';

function buildRateLimitMessage(label) {
  return {
    error: `Too many ${label} requests from this IP. Please wait a few minutes and try again.`
  };
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildRateLimitMessage('authentication')
});

export const analyzeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildRateLimitMessage('analysis')
});
