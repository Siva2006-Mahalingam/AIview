// Simple mock server to emulate Supabase function endpoints used by the app.
// Run with: node mock-functions/server.js

import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json({ limit: "1mb" }));

const PORT = process.env.MOCK_FN_PORT || 54321;

const cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"
  );
};

// Accept OPTIONS for any path under /functions/v1 by using a global OPTIONS handler
// Handle CORS preflight for any route
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    cors(res);
    return res.sendStatus(204);
  }
  return next();
});

// Streaming interview-chat endpoint (SSE-style streaming compatible with app)
app.post("/functions/v1/interview-chat", (req, res) => {
  cors(res);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");

  const { isInit } = req.body || {};

  // Small helper to send a data event
  const sendData = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  const greeting = isInit
    ? "Hello! Welcome to your mock interview. First question: Tell me about a project you're proud of and the technical challenges you solved."
    : "Next question: Can you describe a time you improved performance in a system?";

  // Simulate streaming of a single delta content and then [DONE]
  setTimeout(() => sendData({ choices: [{ delta: { content: greeting } }] }), 100);
  setTimeout(() => sendData({ choices: [{ delta: { content: "" } }] }), 200);
  setTimeout(() => res.write("data: [DONE]\n\n"), 300);

  // Close after a short delay
  setTimeout(() => res.end(), 500);
});

// ElevenLabs TTS endpoint: respond with fallback message (no audio) unless
// ELEVENLABS_API_KEY environment variable is set (not required for local testing)
app.post("/functions/v1/elevenlabs-tts", (req, res) => {
  cors(res);
  res.setHeader("Content-Type", "application/json");

  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  const { text } = req.body || {};

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  if (!ELEVENLABS_API_KEY) {
    // Return fallback payload the frontend knows how to handle
    return res.json({ fallback: true, message: "TTS not configured locally. Showing text instead." });
  }

  // If key present, we could proxy to ElevenLabs here. For now, respond fallback.
  return res.json({ fallback: true, message: "TTS proxy not implemented in mock; set ELEVENLABS_API_KEY to enable." });
});

// ElevenLabs scribe token endpoint (returns a dummy token)
app.post("/functions/v1/elevenlabs-scribe-token", (req, res) => {
  cors(res);
  res.setHeader("Content-Type", "application/json");
  // Return a fake single-use token for the client to use in demo mode
  res.json({ token: "mock-scribe-token-local" });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock functions server listening on http://localhost:${PORT}`);
  console.log("Endpoints:");
  console.log("  POST /functions/v1/interview-chat");
  console.log("  POST /functions/v1/elevenlabs-tts");
  console.log("  POST /functions/v1/elevenlabs-scribe-token");
});

export default app;
