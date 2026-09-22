import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { initDatabase } from './config/db.js';
import { startMembershipCronJob } from './jobs/cronJob.js';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    console.log('[Server] Initializing relational SQL database...');
    await initDatabase();

    console.log('[Server] Starting membership status background cron job...');
    startMembershipCronJob();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] ShopVanguard E-Commerce Backend running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('[Server Error]: Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
