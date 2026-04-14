function parsePort(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parsePort(process.env.PORT, 3000),
  mongoUri: process.env.MONGO_URI ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? '*'
};

export const isProduction = env.nodeEnv === 'production';

export function validateEnvironment() {
  const missingVariables = [];

  if (!env.mongoUri.trim()) {
    missingVariables.push('MONGO_URI');
  }

  if (!env.jwtSecret.trim()) {
    missingVariables.push('JWT_SECRET');
  }

  if (missingVariables.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}.`);
  }
}
