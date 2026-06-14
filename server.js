/**
 * Carrier — Živý překladač řeči (Cloud Run service).
 *
 * Real-time speech-to-speech překlad přes Gemini Live API
 * (model gemini-3.5-live-translate-preview, 70+ jazyků).
 *
 * Bezpečnost: API klíč NIKDY neopouští server. Frontend si přes /api/token
 * vyžádá krátkodobý EPHEMERAL token (omezený na translate model a navíc
 * ZAMČENÝ na konkrétní cílový jazyk), s nímž se připojí přímo na Google.
 *
 * Env vars (Cloud Run):
 *  - GEMINI_API_KEY        — povinné (Secret Manager: veo-gemini-api-key)
 *  - GEMINI_LIVE_MODEL     — volitelné, default 'gemini-3.5-live-translate-preview'
 *  - PORT                  — Cloud Run nastaví na 8080
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.5-live-translate-preview';

// 70+ podporovaných jazyků (BCP-47) — musí sedět se seznamem ve frontendu.
const SUPPORTED = new Set([
  'af','ak','sq','am','ar','hy','az','eu','be','bn','bg','my','ca','zh-Hans','zh-Hant',
  'hr','cs','da','nl','en','et','fil','fi','fr','gl','ka','de','el','gu','ha','he','hi',
  'hu','is','id','it','ja','jv','kn','kk','km','rw','ko','lo','lv','lt','mk','ms','ml',
  'mr','mn','ne','no','nb','fa','pl','pt-BR','pt-PT','pa','ro','ru','sr','sd','si','sk',
  'sl','es','su','sw','sv','ta','te','th','tr','uk','ur','uz','vi','zu',
]);

const app = express();
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'carrier-live-translate', model: MODEL, keyConfigured: !!process.env.GEMINI_API_KEY });
});

// Vyrobí ephemeral token zamčený na daný cílový jazyk (jedna session = jeden token).
app.post('/api/token', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'GEMINI_API_KEY not configured on Cloud Run' } });
  }
  let { target, echo } = req.body || {};
  if (typeof target !== 'string' || !SUPPORTED.has(target)) {
    return res.status(400).json({ error: { message: 'Neplatný cílový jazyk: ' + String(target).slice(0, 20) } });
  }
  const echoTargetLanguage = echo === true || echo === 'true';

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        liveConnectConstraints: {
          model: MODEL,
          config: {
            responseModalities: ['AUDIO'],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            translationConfig: { targetLanguageCode: target, echoTargetLanguage },
          },
        },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });
    res.json({ token: token.name, model: MODEL, target, echo: echoTargetLanguage });
  } catch (err) {
    console.error('[live-translate] token failed:', err?.message || err);
    res.status(502).json({ error: { message: 'Token se nepodařilo vytvořit: ' + (err?.message || String(err)).slice(0, 200) } });
  }
});

// === Statický frontend ===
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, { maxAge: '1h', index: false }));
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.listen(PORT, () => {
  console.log(`[carrier-live-translate] listening :${PORT}  model=${MODEL}  key=${process.env.GEMINI_API_KEY ? 'set' : 'MISSING'}`);
});
