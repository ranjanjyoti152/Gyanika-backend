# Gyanika JS Agent

This worker runs the Gyanika assistant inside LiveKit using Google Gemini realtime models.

## Available Features

- **Realtime voice + camera intake**: joins rooms with audio and video inputs enabled so you can talk face to face; subscribed video tracks are kept in `session.userData.videoStreams` for custom processing or routing.
- **Screen-share awareness**: automatically subscribes to participants' screen-share tracks for contextual awareness.
- **Tooling parity with Python agent**: weather lookup, web search, email, system control, file ops, shell execution, Wi-Fi toggle, and Qdrant-based learning progress.

## Prerequisites

- Node.js 20+
- LiveKit credentials (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`)
- Google Gemini API key with access to `models/gemini-2.5-flash-native-audio-preview-09-2025`
- Optional tool credentials (`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `QDRANT_URL`, etc.) saved in `.env`

## Install & Run

```bash
cd js-agent
npm install
npm run start
```

The start script builds the TypeScript sources and launches the LiveKit worker in development mode (`node dist/agent.js dev`). Keep the terminal session running to maintain the worker connection.
