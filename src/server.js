import 'dotenv/config';

import app from './app.js';
import { connectToDatabase } from './config/db.js';
import { env, validateEnvironment } from './config/env.js';

async function startServer() {
  try {
    validateEnvironment();
    await connectToDatabase();

    const PORT = process.env.PORT || env.port;

app.listen(PORT, () => {
  console.info(`Server running on port ${PORT}`);
});
  } catch (error) {
    console.error('Server failed to start.', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection.', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception.', error);
  process.exit(1);
});

startServer();
