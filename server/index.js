import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import http from 'http';
import { speechTokenRouter } from './token-route.js';
import { initOptimizedSocket } from './websocket.js';
import { performanceMonitor } from './performance-monitor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Local proxy for Azure Speech SDK script placed BEFORE static to avoid static 404
app.get('/sdk/speech.js', async (req, res) => {
  try {
    const url = 'https://aka.ms/csspeech/jsbrowserpackageraw';
    const response = await fetch(url);
    if (!response.ok) {
      res.status(response.status).send('Failed to fetch Speech SDK');
      return;
    }
    res.setHeader('Content-Type', 'application/javascript');
    const text = await response.text();
    res.send(text);
  } catch (e) {
    console.error('SDK proxy error (early route)', e);
    res.status(502).send('SDK proxy error');
  }
});
// Performance monitoring middleware
app.use(performanceMonitor);

// Serve static files
app.use('/', express.static(path.join(__dirname, '..', 'public')));

// Token endpoint for Speech SDK
app.use('/api/speech', speechTokenRouter);

// Performance metrics endpoint
app.get('/api/metrics', (req, res) => {
  res.json(global.performanceMetrics || {});
});

// Health check
app.get('/healthz', (_req, res) => res.json({
  ok: true,
  method: 'direct-translation',
  version: '2.0.0'
}));

// Speech config endpoint for client SDK initialization
app.get('/speech-config', (req, res) => {
  res.json({
    region: process.env.SPEECH_REGION,
    key: process.env.SPEECH_KEY
  });
});
// Local proxy for Azure Speech SDK script to avoid extension/CDN blocking
app.get('/sdk/speech.js', async (req, res) => {
  try {
    const url = 'https://aka.ms/csspeech/jsbrowserpackageraw';
    const response = await fetch(url);
    if (!response.ok) {
      res.status(response.status).send('Failed to fetch Speech SDK');
      return;
    }
    res.setHeader('Content-Type', 'application/javascript');
    const text = await response.text();
    res.send(text);
  } catch (e) {
    console.error('SDK proxy error', e);
    res.status(502).send('SDK proxy error');
  }
});

const server = http.createServer(app);

// Configure Socket.IO with optimizations
const io = new Server(server, {
  cors: { origin: '*' },
  // Binary frames for audio streaming
  perMessageDeflate: false,
  // Increase max buffer size for audio
  maxHttpBufferSize: 1e8,
  // Reduce pingTimeout for faster disconnection detection
  pingTimeout: 10000,
  pingInterval: 5000,
  // Allow both polling and websocket transports
  transports: ['polling', 'websocket']
});

// Initialize optimized WebSocket handling
initOptimizedSocket(io);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Optimized S2S Server v2.0`);
  console.log(`📡 Direct Translation Mode: ENABLED`);
  console.log(`🔊 Listening on http://localhost:${PORT}`);
  console.log(`⚡ Latency Target: <200ms`);
});