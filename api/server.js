/**
 * ChefBot API layer: chat endpoints, session context, Ollama proxy.
 * Serves static frontend from ./public.
 */

const express = require('express');
const path = require('path');
const { checkDomain } = require('./domain');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const OLLAMA_HOST = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'tinyllama';

// RapidAPI ChatGPT-42
const RAPIDAPI_URL = process.env.RAPIDAPI_URL || 'https://chatgpt-42.p.rapidapi.com/chat';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '18c4b2fd16msh32d393319e95b02p1ebdb6jsncda25d8eb8d3';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'chatgpt-42.p.rapidapi.com';

const MODE_PROMPTS = {
  recipe: {
    focus: 'Focus on recipes: provide clear step-by-step instructions, ingredient lists, and cooking times.',
    format: 'Use structured format: ingredients list, step-by-step instructions, cooking time. Be specific and actionable.',
    validate: 'Your answer must directly address the recipe question with clear steps and ingredients.'
  },
  ingredient: {
    focus: 'Focus on ingredients: explain substitutions, storage, selection, and nutritional aspects.',
    format: 'Use structured format: explain the ingredient, substitutions if asked, storage tips, usage. Be practical.',
    validate: 'Your answer must directly address the ingredient question with useful substitutions or information.'
  },
  tips: {
    focus: 'Focus on kitchen tips: techniques, equipment usage, food safety, and professional tricks.',
    format: 'Use clear bullet points or numbered tips. Be concise and actionable.',
    validate: 'Your answer must provide practical kitchen tips relevant to the question.'
  },
  menu: {
    focus: 'Focus on menu planning: meal ideas, pairing suggestions, and balanced meal composition.',
    format: 'Suggest meal ideas with pairing notes. Consider balance and variety.',
    validate: 'Your answer must provide menu or meal suggestions relevant to the question.'
  }
};

const LANGUAGE_RULES = {
  id: {
    primary: 'CRITICAL: You MUST respond ONLY in Indonesian (Bahasa Indonesia). Every word, sentence, and paragraph must be in Indonesian. Never use English or any other language.',
    reinforce: 'Jawablah HANYA dalam Bahasa Indonesia. Jangan gunakan bahasa Inggris sama sekali.',
    validation: 'Before responding, verify: Is my entire answer in Indonesian? If any part is in English, rewrite it in Indonesian.'
  },
  en: {
    primary: 'CRITICAL: You MUST respond ONLY in English. Every word, sentence, and paragraph must be in English. Never use Indonesian or other languages.',
    reinforce: 'Answer ONLY in English. Do not use Indonesian or any other language.',
    validation: 'Before responding, verify: Is my entire answer in English? If any part is in another language, rewrite it in English.'
  }
};

// Indonesian word patterns for language validation (common words that appear in Indonesian text)
const INDONESIAN_INDICATORS = [
  'yang', 'dengan', 'adalah', 'untuk', 'dalam', 'ini', 'itu', 'cara', 'bisa', 'juga',
  'atau', 'akan', 'ada', 'dari', 'pada', 'dan', 'ke', 'di', 'oleh', 'serta',
  'seperti', 'lebih', 'sudah', 'belum', 'harus', 'perlu', 'dapat', 'membuat',
  'memasak', 'masakan', 'resep', 'bahan', 'langkah', 'menit', 'jam', 'sajikan',
  'panaskan', 'tambahkan', 'campurkan', 'iris', 'potong', 'goreng', 'rebus',
  'panggang', 'kukus', 'tumis', 'aduk', 'angkat', 'siap', 'selamat', 'anda',
  'pertama', 'kemudian', 'terakhir', 'siapkan', 'campur', 'masukkan', 'gunakan'
];

// English word patterns (common in English cooking responses)
const ENGLISH_INDICATORS = [
  'the', 'and', 'for', 'with', 'this', 'that', 'you', 'your', 'can', 'will',
  'step', 'ingredients', 'instructions', 'minutes', 'heat', 'add', 'mix',
  'cooking', 'recipe', 'stir', 'combine', 'serve', 'preheat', 'until', 'into',
  'first', 'then', 'finally', 'place', 'bowl', 'pan', 'oven'
];

// Strong signals: reply starts with these = likely wrong language
const INDONESIAN_START_PHRASES = ['untuk ', 'cara ', 'pertama', 'anda ', 'bahan', 'langkah', 'panaskan', 'tambahkan', 'campurkan', 'sajikan', 'memasak'];
const ENGLISH_START_PHRASES = ['to ', 'first', 'you ', 'the ', 'heat ', 'add ', 'mix ', 'combine ', 'serve ', 'step ', 'ingredients'];

function buildSystemPrompt(mode, language) {
  const modeConfig = MODE_PROMPTS[mode] || MODE_PROMPTS.recipe;
  const langConfig = LANGUAGE_RULES[language === 'id' ? 'id' : 'en'];

  return `You are ChefBot, a kitchen and cooking expert assistant.

## RULE 1 - LANGUAGE (HIGHEST PRIORITY)
${langConfig.primary}
${langConfig.reinforce}
${langConfig.validation}

## RULE 2 - MODE & FORMAT
Current mode: ${mode}
${modeConfig.focus}
Format: ${modeConfig.format}
Validation: ${modeConfig.validate}

## RULE 3 - CONTENT
- Answer ONLY about kitchen, cooking, and food topics.
- Base your answer directly on the user's question.
- Be concise, practical, and encouraging.
- If the question is outside cooking, politely say you only help with culinary topics.
- Do not provide medical, legal, or general advice.`;
}

function buildUserMessageWithContext(userMessage, mode, language) {
  const langTag = language === 'id'
    ? '[BAHASA: Indonesia - Jawab HANYA dalam Bahasa Indonesia]'
    : '[LANGUAGE: English - Answer ONLY in English]';
  const modeTag = `[MODE: ${mode}]`;
  return `${langTag} ${modeTag}\n\n${userMessage}`;
}

// In-memory session context: sessionId -> array of { role, content }
const sessionContext = new Map();
const MAX_CONTEXT_MESSAGES = 20;

// Optional in-memory cache: question -> reply (simple, no TTL for prototype)
const replyCache = new Map();
const MAX_CACHE_SIZE = 50;

app.use(express.json());
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id, X-Mode, X-Language, X-Service');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

function getSessionId(req) {
  return req.headers['x-session-id'] || 'default';
}

function getContext(sessionId) {
  if (!sessionContext.has(sessionId)) {
    sessionContext.set(sessionId, []);
  }
  return sessionContext.get(sessionId);
}

function buildMessages(sessionId, userMessage, mode, language) {
  const context = getContext(sessionId);
  const systemPrompt = buildSystemPrompt(mode || 'recipe', language || 'en');
  const userContent = buildUserMessageWithContext(userMessage, mode || 'recipe', language || 'en');
  const messages = [
    { role: 'system', content: systemPrompt },
    ...context.slice(-(MAX_CONTEXT_MESSAGES - 2)).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent }
  ];
  return messages;
}

/**
 * Validate if reply matches expected language based on heuristics.
 * Uses: word indicators, start phrases, and overall balance.
 * @param {string} reply - AI response text
 * @param {string} language - Expected language ('id' or 'en')
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateReplyLanguage(reply, language) {
  if (!reply || typeof reply !== 'string') return { valid: false, reason: 'empty' };
  const text = reply.toLowerCase().trim();
  const wordCount = (text.match(/\b\w+\b/g) || []).length;
  if (wordCount < 3) return { valid: true }; // Too short to validate

  const first50 = text.substring(0, 80);
  const idCount = INDONESIAN_INDICATORS.filter(w => text.includes(w)).length;
  const enCount = ENGLISH_INDICATORS.filter(w => text.includes(w)).length;

  if (language === 'id') {
    // Strong signal: starts with Indonesian phrase = valid
    if (INDONESIAN_START_PHRASES.some(p => first50.startsWith(p))) return { valid: true };
    // Strong signal: starts with English phrase = invalid
    if (ENGLISH_START_PHRASES.some(p => first50.startsWith(p)) && idCount < 2)
      return { valid: false, reason: 'reply_appears_english' };
    // Balance check: more English than Indonesian = invalid
    if (enCount >= 4 && idCount < 2) return { valid: false, reason: 'reply_appears_english' };
    if (idCount >= 2) return { valid: true };
  } else {
    if (ENGLISH_START_PHRASES.some(p => first50.startsWith(p))) return { valid: true };
    if (INDONESIAN_START_PHRASES.some(p => first50.startsWith(p)) && enCount < 2)
      return { valid: false, reason: 'reply_appears_indonesian' };
    if (idCount >= 4 && enCount < 2) return { valid: false, reason: 'reply_appears_indonesian' };
    if (enCount >= 2) return { valid: true };
  }
  return { valid: true }; // Default: allow
}

/**
 * Build retry prompt when language validation fails.
 */
function buildLanguageFixPrompt(originalReply, language) {
  if (language === 'id') {
    return `The following answer was given in English or mixed language. Rewrite it ENTIRELY in Indonesian (Bahasa Indonesia). Keep the same content and structure. Do not use any English words.\n\n---\n${originalReply}\n---\n\nJawablah ulang seluruhnya dalam Bahasa Indonesia:`;
  }
  return `The following answer was given in Indonesian or mixed language. Rewrite it ENTIRELY in English. Keep the same content and structure. Do not use any Indonesian words.\n\n---\n${originalReply}\n---\n\nRewrite entirely in English:`;
}

async function callOllama(messages) {
  const url = `${OLLAMA_HOST}/api/chat`;
  const body = { model: OLLAMA_MODEL, messages, stream: false };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(err => {
    const e = new Error(`Ollama connection failed: ${err.message}`);
    e.cause = err;
    throw e;
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.message?.content ?? '';
}

/**
 * Call RapidAPI ChatGPT-42 for chat completion.
 * Uses messages array format (OpenAI-style).
 */
async function callRapidAPI(messages) {
  const res = await fetch(RAPIDAPI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': RAPIDAPI_HOST
    },
    body: JSON.stringify({ messages })
  }).catch(err => {
    const e = new Error(`RapidAPI connection failed: ${err.message}`);
    e.cause = err;
    throw e;
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RapidAPI error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  // Support common response formats: result, choices[0].message.content, message.content
  const content = data.result ?? data.choices?.[0]?.message?.content ?? data.message?.content ?? data.response ?? '';
  return typeof content === 'string' ? content : (content?.text ?? JSON.stringify(content));
}

// --- Health ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'chefbot-api' });
});

// --- Service check: verify selected service is ready ---
app.get('/api/service-check', async (req, res) => {
  const service = (req.query.service || 'api').toLowerCase();
  if (service !== 'api' && service !== 'docker') {
    return res.status(400).json({ ok: false, error: 'Invalid service', hint: 'Use ?service=api or ?service=docker' });
  }
  try {
    if (service === 'docker') {
      const tagsRes = await fetch(`${OLLAMA_HOST}/api/tags`);
      if (!tagsRes.ok) throw new Error(`Ollama returned ${tagsRes.status}`);
      const tags = await tagsRes.json();
      const models = tags?.models || [];
      const hasModel = models.some(m => (m.name || '').toLowerCase().includes(OLLAMA_MODEL.toLowerCase()));
      return res.json({
        ok: true,
        service: 'docker',
        ollama: 'ok',
        modelPulled: hasModel,
        hint: hasModel ? null : `Pull model: docker compose exec ollama ollama pull ${OLLAMA_MODEL}`
      });
    }
    // API (RapidAPI): verify config and optional connectivity
    if (!RAPIDAPI_KEY || !RAPIDAPI_HOST) {
      throw new Error('RAPIDAPI_KEY and RAPIDAPI_HOST must be set');
    }
    return res.json({ ok: true, service: 'api' });
  } catch (err) {
    const code = err.cause?.code ?? err.code;
    const hint = service === 'docker'
      ? 'Run: docker compose up -d, then: docker compose exec ollama ollama pull tinyllama'
      : 'Check RAPIDAPI_KEY and RAPIDAPI_HOST. Ensure RapidAPI subscription is active.';
    return res.status(502).json({
      ok: false,
      service,
      error: err.message,
      code: code,
      hint
    });
  }
});

// --- Status: check Ollama connectivity ---
app.get('/api/status', async (req, res) => {
  try {
    let tagsRes;
    try {
      tagsRes = await fetch(`${OLLAMA_HOST}/api/tags`);
    } catch (err) {
      const code = err.cause?.code ?? err.code;
      return res.json({
        ollama: 'unreachable',
        message: err.message,
        code: code,
        hint: code === 'ECONNREFUSED'
          ? 'Ollama is not running. Run: docker compose up -d'
          : 'Run: docker compose up -d, then: docker compose exec ollama ollama pull tinyllama'
      });
    }
    if (!tagsRes.ok) {
      const text = await tagsRes.text();
      return res.json({
        ollama: 'error',
        message: `Ollama returned ${tagsRes.status}: ${text.substring(0, 200)}`,
        hint: 'Ensure Ollama is running: docker compose up -d'
      });
    }
    const tags = await tagsRes.json();
    const models = tags?.models || [];
    const hasModel = models.some(m => (m.name || '').toLowerCase().includes(OLLAMA_MODEL.toLowerCase()));
    res.json({
      ollama: 'ok',
      model: OLLAMA_MODEL,
      modelPulled: hasModel,
      models: models.map(m => m.name || m.model),
      hint: hasModel ? null : `Pull the model: docker compose exec ollama ollama pull ${OLLAMA_MODEL}`
    });
  } catch (err) {
    console.error('Status check failed:', err);
    res.json({
      ollama: 'error',
      message: err.message,
      hint: 'Run: docker compose up -d'
    });
  }
});

// --- Clear context ---
app.post('/api/clear', (req, res) => {
  const sessionId = getSessionId(req);
  sessionContext.set(sessionId, []);
  res.json({ ok: true, message: 'Context cleared' });
});

// --- Chat ---
app.all('/api/chat', (req, res, next) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      detail: 'Use POST to send messages',
      allowed: ['POST']
    });
  }
  next();
});
app.post('/api/chat', async (req, res) => {
  const sessionId = getSessionId(req);
  const rawMessage = req.body?.message;
  const userMessage = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  const mode = req.body?.mode || req.headers['x-mode'] || 'recipe';
  const language = req.body?.language || req.headers['x-language'] || 'en';
  const service = (req.body?.service || req.headers['x-service'] || 'api').toLowerCase();
  const useApi = service === 'api';

  if (!userMessage) {
    return res.status(400).json({ error: 'Missing or empty message' });
  }

  const domain = checkDomain(userMessage);
  if (!domain.allowed) {
    return res.json({
      reply: domain.message,
      cached: false,
      denied: true
    });
  }

  const cacheKey = userMessage.toLowerCase() + '|' + mode + '|' + language + '|' + service;
  const cached = replyCache.get(cacheKey);
  if (cached) {
    const context = getContext(sessionId);
    context.push({ role: 'user', content: userMessage });
    context.push({ role: 'assistant', content: cached });
    if (context.length > MAX_CONTEXT_MESSAGES) context.splice(0, context.length - MAX_CONTEXT_MESSAGES);
    return res.json({ reply: cached, cached: true });
  }

  const messages = buildMessages(sessionId, userMessage, mode, language);
  let reply;
  try {
    reply = useApi ? await callRapidAPI(messages) : await callOllama(messages);
  } catch (err) {
    console.error(useApi ? 'RapidAPI request failed:' : 'Ollama request failed:', err.message);
    let detail;
    const code = err.cause?.code ?? err.code;
    if (useApi) {
      detail = err.message.includes('RapidAPI') ? err.message : `RapidAPI error: ${err.message}. Check RAPIDAPI_KEY and subscription.`;
    } else {
      detail = 'Could not reach the local model. ';
      if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
        detail += 'Ollama is not running or not reachable. Start it with: docker compose up -d';
      } else if (err.message.includes('404') || err.message.includes('not found')) {
        detail += 'Model not found. Pull it with: docker compose exec ollama ollama pull tinyllama';
      } else {
        detail += 'Ensure Ollama is running and the model is pulled (e.g. docker compose exec ollama ollama pull tinyllama).';
      }
    }
    return res.status(502).json({
      error: useApi ? 'API unavailable' : 'Model unavailable',
      detail: detail
    });
  }

  // Validate reply language; retry with fix prompt if needed
  const langValidation = validateReplyLanguage(reply, language);
  if (!langValidation.valid && langValidation.reason) {
    try {
      const fixMessages = [
        { role: 'system', content: language === 'id'
          ? 'You are a translator. Rewrite the given text ENTIRELY in Indonesian (Bahasa Indonesia). Preserve all content, structure, and meaning. Use only Indonesian words.'
          : 'You are a translator. Rewrite the given text ENTIRELY in English. Preserve all content, structure, and meaning. Use only English words.'
        },
        { role: 'user', content: buildLanguageFixPrompt(reply, language) }
      ];
      const fixedReply = useApi ? await callRapidAPI(fixMessages) : await callOllama(fixMessages);
      if (fixedReply && fixedReply.trim().length > 0) {
        reply = fixedReply.trim();
        console.log('ChefBot: Language validation failed, applied fix for', language);
      }
    } catch (fixErr) {
      console.warn('ChefBot: Language fix retry failed:', fixErr.message);
      // Keep original reply if fix fails
    }
  }

  const context = getContext(sessionId);
  context.push({ role: 'user', content: userMessage });
  context.push({ role: 'assistant', content: reply });
  if (context.length > MAX_CONTEXT_MESSAGES) {
    context.splice(0, context.length - MAX_CONTEXT_MESSAGES);
  }

  if (replyCache.size >= MAX_CACHE_SIZE) {
    const firstKey = replyCache.keys().next().value;
    if (firstKey) replyCache.delete(firstKey);
  }
  replyCache.set(cacheKey, reply);

  res.json({ reply, cached: false });
});

// --- Static frontend ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ChefBot API listening on port ${PORT}`);
  console.log(`Services: API (RapidAPI), Docker (Ollama: ${OLLAMA_HOST}, model: ${OLLAMA_MODEL})`);
});
