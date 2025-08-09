// server/token-route.js
import express from 'express';
import { request } from 'undici';

export const speechTokenRouter = express.Router();

speechTokenRouter.get('/token', async (_req, res) => {
  try {
    const region = process.env.SPEECH_REGION;
    const key = process.env.SPEECH_KEY;
    if (!region || !key) {
      return res.status(500).json({ error: 'Missing SPEECH_REGION or SPEECH_KEY' });
    }

    const r = await request(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key }
    });

    if (r.statusCode !== 200) {
      const body = await r.body.text();
      console.error('STS error', r.statusCode, body);
      return res.status(502).json({ error: 'token_failed', status: r.statusCode, body });
    }

    const token = await r.body.text();
    res.json({ token, region });
  } catch (e) {
    console.error('Speech token error', e);
    res.status(500).json({ error: 'token_failed' });
  }
});
