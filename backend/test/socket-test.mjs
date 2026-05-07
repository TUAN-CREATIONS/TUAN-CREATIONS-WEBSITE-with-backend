import { io } from 'socket.io-client';

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const courseId = Number(process.env.COURSE_ID || 1);

async function post(path, body = {}, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function get(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  return res.json();
}

async function run() {
  console.log('[Test] Starting socket.io integration test against', API_BASE);

  // 1) Create student user and login
  const studentPayload = { name: 'Test Student', email: `student+${Date.now()}@example.com`, role: 'student' };
  const loginStudent = await post('/api/auth/login', studentPayload);
  const studentToken = loginStudent?.token;
  console.log('[Test] Student token:', !!studentToken);

  // 2) Enroll student
  const enroll = await post(`/api/academy/enroll/${courseId}`, {}, studentToken);
  console.log('[Test] Enroll response:', enroll && enroll.enrollment ? 'ok' : JSON.stringify(enroll).slice(0,200));

  // 3) Create instructor and login
  const instrPayload = { name: 'Test Instructor', email: `instructor+${Date.now()}@example.com`, role: 'instructor' };
  const loginInstr = await post('/api/auth/login', instrPayload);
  const instrToken = loginInstr?.token;
  console.log('[Test] Instructor token:', !!instrToken);

  // 4) Connect socket as student
  const socket = io(new URL(API_BASE).origin, { transports: ['websocket'], auth: { token: studentToken } });

  socket.on('connect', () => {
    console.log('[Socket-Test] connected', socket.id);
    socket.emit('live:join', { courseId });
  });

  socket.on('live:room-state', (state) => {
    console.log('[Socket-Test] room-state received, participants:', (state.participants||[]).length);
  });

  socket.on('live:error', (err) => {
    console.error('[Socket-Test] live:error', err);
  });

  socket.on('live:chat-message', (msg) => {
    console.log('[Socket-Test] chat message:', msg.text.substring(0,50));
  });

  // Wait a bit then send a chat message via socket
  await new Promise((r) => setTimeout(r, 2000));
  socket.emit('live:chat-message', { courseId, text: 'Hello from automated test' });

  // 5) Use instructor token to start recording
  // 5) Use instructor token to start recording (with retry)
  const retryPost = async (path, body, token, attempts = 5, delay = 1500) => {
    for (let i = 0; i < attempts; i++) {
      try {
        const resp = await post(path, body, token);
        return resp;
      } catch (err) {
        console.warn(`[Test] POST ${path} attempt ${i + 1} failed:`, err.message || err);
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error(`Failed POST ${path} after ${attempts} attempts`);
  };

  let startRec;
  try {
    startRec = await retryPost(`/api/academy/courses/${courseId}/recording/start`, {}, instrToken);
    console.log('[Test] start recording:', startRec);
  } catch (err) {
    console.error('[Test] start recording failed:', err.message || err);
  }

  // Wait and then stop recording (provide a dummy recordingUrl)
  await new Promise((r) => setTimeout(r, 2000));
  let stopRec;
  try {
    stopRec = await retryPost(`/api/academy/courses/${courseId}/recording/stop`, { recordingUrl: `/recordings/test-${Date.now()}.mp4`, duration: 120, videoProvider: 'test' }, instrToken);
    console.log('[Test] stop recording:', stopRec && stopRec.recording ? 'saved' : JSON.stringify(stopRec).slice(0,200));
  } catch (err) {
    console.error('[Test] stop recording failed:', err.message || err);
  }

  // Cleanup
  await new Promise((r) => setTimeout(r, 1000));
  socket.disconnect();
  console.log('[Test] finished');
}

run().catch((err) => { console.error('[Test] failed', err); process.exit(1); });
