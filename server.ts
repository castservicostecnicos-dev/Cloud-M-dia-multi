import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes.js';
import { db, uploadsDir } from './server/db.js';
import { loadMediaBinaryFromFirestore } from './server/firestore.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Start Firestore restoration immediately in background, and let API routes await it (max 2.5s)
  const firestoreReadyPromise = Promise.race([
    db.initFromFirestore().catch((err) => {
      console.error('[Startup] Failed to restore from Firestore:', err);
    }),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);

  // Enable CORS so frontend can run as a separate static site if desired
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Disposition'],
    })
  );

  // Serve persistent uploads folder with automatic cloud recovery on cache miss
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const recoverUploadIfMissing: express.RequestHandler = async (req, _res, next) => {
    try {
      const requestedFile = path.basename(req.path || '');
      if (!requestedFile || requestedFile.includes('..')) {
        return next();
      }
      const localFilePath = path.join(uploadsDir, requestedFile);
      if (fs.existsSync(localFilePath)) {
        return next();
      }

      // 1. Try restoring from Firestore binary chunks
      const cloudBuffer = await loadMediaBinaryFromFirestore(requestedFile);
      if (cloudBuffer && cloudBuffer.length > 0) {
        fs.writeFileSync(localFilePath, cloudBuffer);
        console.log(`[Media Recovery] Restored ${requestedFile} (${cloudBuffer.length} bytes) from Firestore.`);
        return next();
      }

      // 2. Try restoring from Google Drive if media has drive_file_id
      const data = db.getData();
      const matchedMedia = data.media.find(
        (m) => m.file_url?.endsWith(`/${requestedFile}`) && m.drive_file_id
      );
      const matchedDoc = data.drive_documents?.find(
        (d) => d.local_url?.endsWith(`/${requestedFile}`) && d.drive_file_id
      );
      const driveFileId = matchedMedia?.drive_file_id || matchedDoc?.drive_file_id;
      if (driveFileId) {
        const token = db.getDriveSettings()?.access_token || process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const driveRes = await fetch(
          token
            ? `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`
            : `https://drive.google.com/uc?export=download&id=${driveFileId}`,
          { headers }
        ).catch(() => null);

        if (driveRes && driveRes.ok) {
          const arrBuf = await driveRes.arrayBuffer();
          const buf = Buffer.from(arrBuf);
          if (buf.length > 0) {
            fs.writeFileSync(localFilePath, buf);
            console.log(`[Media Recovery] Restored ${requestedFile} (${buf.length} bytes) from Google Drive.`);
            return next();
          }
        }
      }
    } catch (err) {
      console.warn('[Media Recovery] Warning while recovering upload:', err);
    }
    return next();
  };

  app.use('/uploads', recoverUploadIfMissing, express.static(uploadsDir));
  app.use('/api/uploads', recoverUploadIfMissing, express.static(uploadsDir));

  // Middleware for body parsing
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // API health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Indoor Media Server', timestamp: Date.now() });
  });

  // Ensure Firestore data is loaded before processing API requests
  app.use('/api', async (_req, _res, next) => {
    await firestoreReadyPromise;
    next();
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Prevent unhandled /api/* routes from falling through to Vite SPA index.html
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `Endpoint de API não encontrado: ${req.method} ${req.originalUrl}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Indoor Media Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
