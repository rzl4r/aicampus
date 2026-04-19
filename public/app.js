/* =========================================================
   CampusBot — Frontend  |  public/app.js
   All chat messages are sent to the Express backend at /api/chat
   The backend decides whether to use Gemini AI or the local KB.
   ========================================================= */

'use strict';

// ── Config ────────────────────────────────────────────────
const API_BASE    = '';           // same origin — server serves this file
const CHAT_URL    = `${API_BASE}/api/chat`;
const HEALTH_URL  = `${API_BASE}/api/health`;

// ── State ─────────────────────────────────────────────────
let isTyping      = false;
let serverMode    = 'unknown';   // 'gemini' | 'local' | 'offline'
let chatHistory   = [];          // [{role:'user'|'bot', content:'...'}]
let savedSessions = JSON.parse(localStorage.getItem('campusbotSessions') || '[]');
let currentSession = [];

// ── DOM refs ──────────────────────────────────────────────
const sidebar          = document.getElementById('sidebar');
const overlay          = document.getElementById('overlay');
const menuBtn          = document.getElementById('menuBtn');
const sidebarClose     = document.getElementById('sidebarClose');
const newChatBtn       = document.getElementById('newChatBtn');
const clearChatBtn     = document.getElementById('clearChatBtn');
const userInput        = document.getElementById('userInput');
const sendBtn          = document.getElementById('sendBtn');
const chatArea         = document.getElementById('chatArea');
const messagesContainer = document.getElementById('messagesContainer');
const welcomeScreen    = document.getElementById('welcomeScreen');
const charCount        = document.getElementById('charCount');
const historyList      = document.getElementById('historyList');
const quickTopics      = document.getElementById('quickTopics');
const statusDot        = document.getElementById('statusDot');
const statusText       = document.getElementById('statusText');
const modeBadge        = document.getElementById('modeBadge');
const modeText         = document.getElementById('modeText');
const modeDot          = modeBadge.querySelector('.mode-dot');

// ── Server Health Check ───────────────────────────────────
async function checkHealth() {
  try {
    const res  = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    serverMode = data.mode === 'gemini-ai' ? 'gemini' : 'local';
    updateStatusUI(serverMode);
  } catch {
    serverMode = 'offline';
    updateStatusUI('offline');
  }
}

function updateStatusUI(mode) {
  statusDot.className = 'status-dot';
  modeDot.className   = 'mode-dot';

  if (mode === 'gemini') {
    statusDot.classList.add('online');
    statusText.textContent = 'Gemini AI Active';
    modeDot.classList.add('gemini');
    modeText.textContent = '✦ Google Gemini AI';
  } else if (mode === 'local') {
    statusDot.classList.add('local');
    statusText.textContent = 'Local KB Mode';
    modeDot.classList.add('local');
    modeText.textContent = '⚡ Built-in Knowledge';
  } else {
    statusDot.classList.add('offline');
    statusText.textContent = 'Server Offline';
    modeDot.classList.add('error');
    modeText.textContent = '✕ Server Unreachable';
  }
}

// ── Sidebar ───────────────────────────────────────────────
menuBtn.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('visible'); });
sidebarClose.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);
function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('visible'); }

// ── Quick Topics ──────────────────────────────────────────
quickTopics.addEventListener('click', e => {
  const btn = e.target.closest('.topic-btn');
  if (btn?.dataset.query) { closeSidebar(); sendMessage(btn.dataset.query); }
});

// ── Chips ─────────────────────────────────────────────────
document.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (chip?.dataset.query) sendMessage(chip.dataset.query);
});

// ── Input Handling ────────────────────────────────────────
userInput.addEventListener('input', () => {
  const len = userInput.value.length;
  charCount.textContent = `${len}/500`;
  sendBtn.disabled = len === 0 || isTyping;
  autoResize(userInput);
});
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) handleSend(); }
});
sendBtn.addEventListener('click', handleSend);

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
function handleSend() {
  const text = userInput.value.trim();
  if (!text || isTyping) return;
  sendMessage(text);
  userInput.value = '';
  charCount.textContent = '0/500';
  autoResize(userInput);
  sendBtn.disabled = true;
}

// ── Core Send ─────────────────────────────────────────────
async function sendMessage(text) {
  hideWelcome();
  appendUserMessage(text);

  // Maintain conversation history for multi-turn context (Gemini)
  chatHistory.push({ role: 'user', content: text });
  currentSession.push({ role: 'user', text, ts: Date.now() });

  showTyping();

  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: chatHistory.slice(-20)   // send last 20 turns for context
      }),
      signal: AbortSignal.timeout(15000)  // 15s timeout
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}`);
    }

    const data = await res.json();
    removeTyping();

    const reply = data.reply || 'Sorry, I couldn\'t get a response.';
    const mode  = data.mode  || 'local';

    appendBotMessage(reply, mode);
    chatHistory.push({ role: 'bot', content: reply });
    currentSession.push({ role: 'bot', text: reply, ts: Date.now() });

    // Update mode badge from response
    if (mode === 'gemini') updateStatusUI('gemini');
    else updateStatusUI('local');

  } catch (err) {
    removeTyping();
    appendErrorMessage(err.message.includes('timeout')
      ? 'The request timed out. Please try again.'
      : `Could not reach the server. Make sure it's running on port 3000.`
    );
  }
}

// ── DOM Builders ──────────────────────────────────────────
function hideWelcome() { welcomeScreen.classList.add('hidden'); }

function appendUserMessage(text) {
  const group = document.createElement('div');
  group.className = 'message-group user-group';
  group.innerHTML = `
    <div class="avatar user-avatar-msg">U</div>
    <div class="message-content">
      <div class="bubble user-bubble">${escHtml(text)}</div>
      <p class="msg-time">${fmtTime(Date.now())}</p>
    </div>`;
  messagesContainer.appendChild(group);
  scrollBottom();
}

function appendBotMessage(text, mode) {
  const group = document.createElement('div');
  group.className = 'message-group bot-group';
  const modeLabel = mode === 'gemini' ? 'Gemini AI' : 'Campus KB';
  const modeCls   = mode === 'gemini' ? 'gemini' : 'local';

  group.innerHTML = `
    <div class="avatar bot-avatar-msg">${botSVG()}</div>
    <div class="message-content">
      <div class="bubble bot-bubble">${renderMarkdown(text)}</div>
      <div class="mode-pill">
        <span class="mode-pill-dot ${modeCls}"></span>
        ${modeLabel} · ${fmtTime(Date.now())}
      </div>
    </div>`;
  messagesContainer.appendChild(group);
  scrollBottom();
}

function appendErrorMessage(msg) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:0 16px;max-width:860px;margin:0 auto;width:100%;margin-bottom:12px;';
  wrap.innerHTML = `
    <div class="error-bubble">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      ${escHtml(msg)}
    </div>`;
  chatArea.appendChild(wrap);
  scrollBottom();
}

function showTyping() {
  isTyping = true; sendBtn.disabled = true;
  const el = document.createElement('div');
  el.className = 'typing-indicator'; el.id = 'typingIndicator';
  el.innerHTML = `<div class="avatar bot-avatar-msg">${botSVG()}</div>
    <div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  chatArea.appendChild(el);
  scrollBottom();
}
function removeTyping() {
  isTyping = false;
  document.getElementById('typingIndicator')?.remove();
  sendBtn.disabled = userInput.value.trim().length === 0;
}

// ── Clear / New Chat ──────────────────────────────────────
clearChatBtn.addEventListener('click', () => {
  if (currentSession.length === 0) return;
  archiveSession();
  clearChat();
  showToast('Chat cleared ✓');
});
newChatBtn.addEventListener('click', () => { archiveSession(); clearChat(); closeSidebar(); showToast('New conversation started ✓'); });

function archiveSession() {
  if (currentSession.length === 0) return;
  const firstUser = currentSession.find(m => m.role === 'user');
  if (!firstUser) return;
  savedSessions.unshift({ id: Date.now(), preview: firstUser.text.substring(0, 45), ts: firstUser.ts });
  savedSessions = savedSessions.slice(0, 12);
  localStorage.setItem('campusbotSessions', JSON.stringify(savedSessions));
  renderHistory();
}
function clearChat() {
  currentSession = [];
  chatHistory = [];
  messagesContainer.innerHTML = '';
  welcomeScreen.classList.remove('hidden');
}

// ── History ───────────────────────────────────────────────
function renderHistory() {
  if (savedSessions.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No previous chats</p>'; return;
  }
  historyList.innerHTML = savedSessions.map(s => `
    <div class="history-item" title="${escHtml(s.preview)}">
      <svg viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
      ${escHtml(s.preview)}${s.preview.length >= 45 ? '…' : ''}
    </div>`).join('');
}

// ── Markdown Renderer ─────────────────────────────────────
function renderMarkdown(text) {
  let h = text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers (### ## #)
    .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s(.+)$/gm,  '<h3>$1</h3>')
    .replace(/^#\s(.+)$/gm,   '<h3>$1</h3>');

  // Bullet lists
  const lines = h.split('\n');
  const out = []; let inList = false;
  for (const line of lines) {
    const bullet = line.match(/^[•\-\*]\s+(.*)/);
    if (bullet) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${bullet[1]}</li>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(line);
    }
  }
  if (inList) out.push('</ul>');
  h = out.join('\n');

  // Paragraphs — split by blank lines
  h = h.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (!block) return '';
    if (block.startsWith('<ul>') || block.startsWith('<h3>') || block.startsWith('<li>')) return block;
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return h;
}

// ── Helpers ───────────────────────────────────────────────
function scrollBottom() { chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' }); }
function fmtTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function botSVG() {
  return `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="url(#bAv)"/><path d="M12 16h16M12 20h10M12 24h12" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="28" cy="24" r="4" fill="white" fill-opacity="0.3" stroke="white" stroke-width="1.5"/><defs><linearGradient id="bAv" x1="0" y1="0" x2="40" y2="40"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs></svg>`;
}

function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  renderHistory();
  await checkHealth();

  // Re-check health every 30s
  setInterval(checkHealth, 30000);

  // Auto welcome on first visit
  if (!localStorage.getItem('campusbot_v2_welcomed')) {
    localStorage.setItem('campusbot_v2_welcomed', '1');
    setTimeout(() => sendMessage('Hello! Tell me what you can help me with.'), 1200);
  }
}

init();
