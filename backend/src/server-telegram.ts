/**
 * Telegram Intel Minimal Server
 * Only loads Telegram Intelligence module
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT || 8001);
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/telegram_intel';

async function main() {
  // Connect to MongoDB
  console.log('[BOOT] Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('[BOOT] MongoDB connected');

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
    trustProxy: true,
  });

  // CORS
  await app.register(cors, {
    origin: process.env.CORS_ORIGINS === '*' ? true : (process.env.CORS_ORIGINS || '*').split(','),
    credentials: true,
  });

  // Health check
  app.get('/api/health', async () => {
    return { ok: true, module: 'telegram-intel', timestamp: new Date().toISOString() };
  });

  // Register ONLY Telegram Intel Module
  console.log('[BOOT] Registering telegram-intel module...');
  try {
    const { telegramIntelPlugin } = await import('./modules/telegram-intel/telegram_intel.plugin.js');
    await app.register(telegramIntelPlugin);
    console.log('[BOOT] Telegram Intel module registered successfully');
  } catch (err) {
    console.error('[BOOT] Failed to register telegram-intel module:', err);
  }

  // Global error handler
  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.status(statusCode).send({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  });

  // Start server
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[BOOT] Server listening on port ${PORT}`);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
