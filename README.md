# Carrier — Živý překladač řeči (`carrier-live-translate`)

Real-time speech-to-speech překlad přes **Gemini Live API**
(model `gemini-3.5-live-translate-preview`, 70+ jazyků).

- **Jednosměrný režim** — mluvíš, slyšíš překlad + vidíš přepis.
- **Obousměrný režim** — dvě paralelní session se prohozenými cíli, pro živou
  konverzaci (obchodník ↔ zahraniční zákazník).

## Bezpečnost

API klíč **nikdy neopouští server**. Frontend si přes `POST /api/token` vyžádá
krátkodobý **ephemeral token** — omezený na translate model a navíc **zamčený na
konkrétní cílový jazyk** — s nímž se připojí přímo na `generativelanguage.googleapis.com`
přes WebSocket (`v1alpha`). Audio teče přímo browser ↔ Google (nízká latence).

## Stack

- Node 20 + Express (`server.js`)
- `@google/genai` ^2.8.0 → `authTokens.create` (ephemeral, v1alpha)
- Frontend `public/index.html` — vanilla, Web Audio (AudioWorklet 16/24 kHz), WebSocket
- Audio: vstup 16-bit PCM 16 kHz mono, výstup 24 kHz mono

## Endpointy

| Metoda | Cesta | Popis |
|---|---|---|
| GET  | `/api/health` | liveness → `{ ok, app, model, keyConfigured }` |
| POST | `/api/token`  | body `{ target, echo }` → `{ token, model, target, echo }` |

## Env vars (Cloud Run)

| Proměnná | Povinné | Default |
|---|---|---|
| `GEMINI_API_KEY` | ano | — (Secret Manager `veo-gemini-api-key`) |
| `GEMINI_LIVE_MODEL` | ne | `gemini-3.5-live-translate-preview` |

> ⚠️ Audio výstup je dražší (preview model) — appka není na nepřetržitý běh.
