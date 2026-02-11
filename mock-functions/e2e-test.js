// Simple end-to-end smoke tests for local dev + mock functions.
// Run with: node mock-functions/e2e-test.js

const ROOT = process.env.ROOT_URL || 'http://localhost:8081';
const MOCK_FN = process.env.MOCK_FN_URL || 'http://localhost:54321';

async function checkRoot() {
  const res = await fetch(ROOT);
  if (!res.ok) throw new Error(`Root check failed: ${res.status}`);
  console.log('Root OK');
}

async function checkChatInit() {
  const res = await fetch(`${MOCK_FN}/functions/v1/interview-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isInit: true }),
  });

  if (!res.ok) throw new Error(`Chat init status ${res.status}`);
  const txt = await res.text();
  // Extract data: lines
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const dataLines = lines.filter((l) => l.startsWith('data:'));
  if (dataLines.length === 0) throw new Error('No data lines in chat response');
  const first = dataLines[0].slice(5).trim();
  if (!first.includes('Hello') && !first.includes('question') && !first.includes('Question')) {
    throw new Error('Chat init did not return expected greeting');
  }
  console.log('Chat init OK');
}

async function checkTTS() {
  const res = await fetch(`${MOCK_FN}/functions/v1/elevenlabs-tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Test' }),
  });
  if (!res.ok) throw new Error(`TTS status ${res.status}`);
  const j = await res.json();
  if (!j.fallback && !j.audioContent) throw new Error('TTS response invalid');
  console.log('TTS OK (fallback or audio present)');
}

async function checkScribe() {
  const res = await fetch(`${MOCK_FN}/functions/v1/elevenlabs-scribe-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Scribe status ${res.status}`);
  const j = await res.json();
  if (!j.token) throw new Error('Scribe token missing');
  console.log('Scribe token OK');
}

(async function run() {
  try {
    console.log('Running smoke tests...');
    await checkRoot();
    await checkChatInit();
    await checkTTS();
    await checkScribe();
    console.log('\nALL TESTS PASSED');
    process.exit(0);
  } catch (err) {
    console.error('\nTEST FAILED:', err.message || err);
    process.exit(2);
  }
})();
