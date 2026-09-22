import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import app from './backend/app.js';
import { initDatabase } from './backend/config/db.js';
import { startMembershipCronJob } from './backend/jobs/cronJob.js';

const PORT = 3000;

async function startServer() {
  try {
    // 1. Initialize relational database (MySQL or embedded SQLite fallback) & run seed data
    console.log('[ShopVanguard] Initializing relational SQL database...');
    await initDatabase();

    // 2. Start background cron job for membership expiry checks
    console.log('[ShopVanguard] Starting membership automated background cron job...');
    startMembershipCronJob();

    // 3. Mount Vite middleware for development or static serving for production
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[ShopVanguard] Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('[ShopVanguard Server Error]:', error);
    process.exit(1);
  }
}

startServer();
