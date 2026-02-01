/**
 * ChefBot frontend: chat UI, suggested questions, sidebar toggle, API calls.
 */

(function () {
  // Get Started flow: landing -> fade out -> loading (4–7s) -> chatbot
  const getStartedPage = document.getElementById('get-started-page');
  const loadingGetStarted = document.getElementById('loading-get-started');
  const loadingTextEl = document.getElementById('loading-text');
  const chatbotPage = document.getElementById('chatbot-page');
  const btnGetStarted = document.getElementById('btn-get-started');

  const LOADING_MESSAGES = [
    'Preparing your kitchen assistant…',
    'Sharpening the knives…',
    'Gathering ingredients…',
    'Setting up the kitchen…',
    'Warming up the stove…',
    'Chopping vegetables…',
    'Mixing the spices…',
    'Almost ready to cook…',
    'Preparing the recipe book…',
    'Getting the apron ready…',
    'Loading culinary tips…',
    'Stirring up some magic…',
  ];

  function pickRandomLoadingMessage() {
    return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
  }

  function showChatbot() {
    if (loadingTextInterval) clearInterval(loadingTextInterval);
    if (loadingGetStarted) {
      loadingGetStarted.classList.add('opacity-0', 'pointer-events-none');
    }
    if (chatbotPage) {
      chatbotPage.classList.remove('opacity-0', 'pointer-events-none');
    }
  }

  let loadingTextInterval;

  btnGetStarted?.addEventListener('click', function () {
    if (!getStartedPage || !loadingGetStarted || !chatbotPage) return;

    // 1. Fade out Get Started page
    getStartedPage.classList.add('fade-out');

    // 2. After fade out, show loading with crossfade
    setTimeout(function () {
      getStartedPage.classList.add('hidden');
      loadingGetStarted.classList.remove('opacity-0', 'pointer-events-none');

      // Set initial random loading text
      if (loadingTextEl) loadingTextEl.textContent = pickRandomLoadingMessage();

      // Rotate loading text every ~1.8s with fade
      loadingTextInterval = setInterval(function () {
        if (loadingTextEl) {
          loadingTextEl.style.opacity = '0';
          setTimeout(function () {
            if (loadingTextEl) {
              loadingTextEl.textContent = pickRandomLoadingMessage();
              loadingTextEl.style.opacity = '1';
            }
          }, 250);
        }
      }, 1800);
    }, 400);

    const duration = 4000 + Math.floor(Math.random() * 3001);
    setTimeout(showChatbot, duration);
  });

  const form = document.getElementById('chat-form');
  const input = document.getElementById('input');
  const sendBtn = document.getElementById('send');
  const messagesEl = document.getElementById('messages');

  const RAPIDAPI_URL = 'https://chatgpt-42.p.rapidapi.com/chat';
  const RAPIDAPI_HOST = 'chatgpt-42.p.rapidapi.com';
  const SESSION_KEY = 'chefbot-session-context';
  const MAX_CONTEXT = 18;

  let cachedApiKey = null;
  async function loadEnv() {
    if (cachedApiKey !== null && cachedApiKey !== '') return cachedApiKey;
    if (typeof window !== 'undefined' && window.CHEFBOT_RAPIDAPI_KEY) {
      cachedApiKey = String(window.CHEFBOT_RAPIDAPI_KEY).trim();
      if (cachedApiKey) return cachedApiKey;
    }
    for (const file of ['./config.env', 'config.env', '.env']) {
      try {
        const res = await fetch(file);
        if (!res.ok) continue;
        const text = await res.text();
        const m = text.match(/RAPIDAPI_KEY\s*=\s*(.+)/);
        if (m) {
          const key = m[1].trim().replace(/^["']|["']$/g, '').split(/\s*#/)[0].trim();
          if (key) {
            cachedApiKey = key;
            return cachedApiKey;
          }
        }
      } catch (_) {}
    }
    cachedApiKey = '';
    return cachedApiKey;
  }

  const MODE_PROMPTS = {
    recipe: { focus: 'Focus on recipes: step-by-step instructions, ingredient lists, cooking times.', format: 'Ingredients list, step-by-step, cooking time.' },
    ingredient: { focus: 'Focus on ingredients: substitutions, storage, selection.', format: 'Explain ingredient, substitutions, storage tips.' },
    tips: { focus: 'Focus on kitchen tips: techniques, equipment, food safety.', format: 'Clear bullet points or numbered tips.' },
    menu: { focus: 'Focus on menu planning: meal ideas, pairing suggestions.', format: 'Meal ideas with pairing notes.' }
  };
  const LANGUAGE_RULES = {
    id: { rule: 'CRITICAL: Respond ONLY in Indonesian (Bahasa Indonesia).' },
    en: { rule: 'CRITICAL: Respond ONLY in English.' }
  };

  function buildSystemPrompt(mode, language) {
    const m = MODE_PROMPTS[mode] || MODE_PROMPTS.recipe;
    const l = LANGUAGE_RULES[language === 'id' ? 'id' : 'en'];
    const redirect = language === 'id'
      ? 'Saya ChefBot, asisten dapur. Saya hanya membantu soal masakan—resep, bahan, teknik. Apa yang ingin Anda tanya?'
      : 'I\'m ChefBot, your kitchen assistant. I only help with cooking—recipes, ingredients, techniques. What would you like to know?';
    return `You are ChefBot, a kitchen and cooking expert. ${l.rule} MODE: ${mode}. ${m.focus} Format: ${m.format} CRITICAL RULES: (1) NEVER say "Hello!", "I'm doing well", "How about you?", or any greeting/small talk. (2) Answer ONLY cooking questions. (3) If the user says hello or asks how you are, respond ONLY with this exact phrase: "${redirect}"`;
  }
  function buildUserMessage(msg, mode, language) {
    const tag = language === 'id' ? '[BAHASA: Indonesia]' : '[LANGUAGE: English]';
    return `${tag} [MODE: ${mode}]\n\n${msg}`;
  }
  const OFF_TOPIC_START = [
    /^(hi|hello|hey|halo|hai|yo|hii|helloo?)\s*[!?.,]*$/i,
    /^how\s+(are|is|r)\s+(you|it|u)\b/i,
    /^how'?s\s+(it\s+)?going/i,
    /^what'?s\s+up/i,
    /^apa\s+kabar/i,
    /^good\s+(morning|afternoon|evening|night|day)\b/i,
    /^(thanks|thank\s+you|thx|ty)\s*[!?.,]*$/i,
    /^(bye|goodbye|see\s+you|good\s+bye)\s*[!?.,]*$/i,
    /^(ok|okay|yes|no|yep|nope)\s*[!?.,]*$/i,
    /^nice\s+to\s+(meet|talk)\s+(you|u)/i,
    /^how\s+about\s+you\s*[!?.,]*$/i,
    /^(what|how)\s+(about|are)\s+you\s*[!?.,]*$/i,
    /^how\s+do\s+you\s+do\b/i,
  ];
  const OFF_TOPIC_CONTAINS = [
    /\bhow\s+are\s+you\b/i,
    /\bhow\s+about\s+you\b/i,
    /\bhow'?s\s+it\s+going\b/i,
    /\bwhat'?s\s+up\b/i,
    /\bapa\s+kabar\b/i,
    /\b(hi|hello|hey)\s*[,!?]?\s*(how|what)/i,
    /\bhow\s+are\s+things\b/i,
    /\bhow\s+have\s+you\s+been\b/i,
    /\bwhat'?s\s+new\b/i,
  ];
  const COOKING_WORDS = ['recipe', 'cook', 'food', 'ingredient', 'kitchen', 'meal', 'dish', 'masak', 'resep', 'bahan', 'makanan', 'dapur', 'menu', 'substitute', 'storage', 'temperature', 'baking', 'sauce', 'soup', 'salad', 'rice', 'noodle', 'meat', 'vegetable', 'spice', 'herb', 'make', 'bake', 'fry', 'boil', 'grill', 'chop', 'pasta', 'chicken', 'beef', 'fish', 'egg', 'flour', 'sugar', 'salt', 'oil'];
  function getRedirectMsg() {
    return currentLanguage === 'id'
      ? 'Saya ChefBot, asisten dapur Anda. Saya hanya membantu soal masakan—resep, bahan, teknik. Apa yang ingin Anda tanya?'
      : 'I\'m ChefBot, your kitchen assistant. I only help with cooking—recipes, ingredients, techniques. What would you like to know?';
  }
  function checkDomain(text) {
    const raw = (text || '').trim();
    const t = raw.toLowerCase();
    if (OFF_TOPIC_START.some(p => p.test(raw))) return { allowed: false, message: getRedirectMsg() };
    if (raw.length < 80 && OFF_TOPIC_CONTAINS.some(p => p.test(raw)) && !COOKING_WORDS.some(w => t.includes(w))) {
      return { allowed: false, message: getRedirectMsg() };
    }
    if (!COOKING_WORDS.some(w => t.includes(w)) && t.length < 25) return { allowed: false, message: getRedirectMsg() };
    return { allowed: true };
  }
  function extractRapidAPIResponse(data) {
    if (!data || typeof data !== 'object') return '';
    const c = data.choices?.[0]?.message?.content;
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (Array.isArray(c)) return c.map(x => (typeof x === 'string' ? x : x?.text || '')).join('').trim() || '';
    const paths = [data.result, data.response, data.content, data.message?.content];
    for (const v of paths) if (typeof v === 'string' && v.trim()) return v.trim();
    return '';
  }
  function cleanApiFooter(text) {
    if (!text || typeof text !== 'string') return '';
    const footerPatterns = [
      /Want best roleplay experience\?[\s\S]*/i,
      /Want the best roleplay experience\?[\s\S]*/i,
      /Try our premium.*?experience[\s\S]*/i,
    ];
    let out = text;
    for (const re of footerPatterns) out = out.replace(re, '');
    return out.trim();
  }
  const GREETING_RESPONSE_PATTERNS = [
    /^hello!?\s*(i'?m|i am)\s+(doing\s+)?well/i,
    /^hi!?\s*(i'?m|i am)\s+(doing\s+)?well/i,
    /^hey!?\s*(i'?m|i am)\s+(doing\s+)?well/i,
    /i'?m\s+(doing\s+)?well,?\s*thank\s+you/i,
    /how\s+about\s+you\s*[!?.,]*\s*$/i,
    /^(hello|hi|hey)!?\s*[!?.,]*\s*$/i,
    /^(i'?m|i am)\s+(fine|good|great|well|doing\s+well)/i,
    /thank\s+you\s+for\s+asking/i,
    /nice\s+to\s+(meet|talk)\s+you/i,
  ];
  function isGreetingResponse(text) {
    if (!text || typeof text !== 'string') return false;
    const t = text.trim().toLowerCase();
    if (t.length > 200) return false;
    return GREETING_RESPONSE_PATTERNS.some(p => p.test(text));
  }
  function markdownToHtml(text) {
    if (!text || typeof text !== 'string') return '';
    if (typeof marked === 'undefined') return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = marked.parse(text, { gfm: true, breaks: true });
    html = html.replace(/<table>/g, '<div class="msg-table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
    return html;
  }
  function getPlainTextFromElement(el) {
    if (!el) return '';
    return el.innerText || el.textContent || '';
  }
  function getSessionContext() {
    try { const s = sessionStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
  }
  function setSessionContext(ctx) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(ctx.slice(-MAX_CONTEXT)));
  }

  let currentMode = 'recipe';
  let currentLanguage = 'en';

  const USER_ICON = '<svg class="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>';

  let typingNode = null;

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setTyping(show) {
    if (typingNode) {
      typingNode.remove();
      typingNode = null;
    }
    if (show) {
      typingNode = document.createElement('div');
      typingNode.className = 'flex gap-4 max-w-2xl typing-indicator';
      typingNode.setAttribute('role', 'status');
      typingNode.setAttribute('aria-live', 'polite');
      typingNode.innerHTML = `
        <div class="flex-shrink-0 w-10 h-10 rounded-full bg-chefbot flex items-center justify-center shadow-soft" aria-hidden="true">
          <span class="text-xl">👨‍🍳</span>
        </div>
        <div class="flex-1 rounded-2xl msg-bot px-5 py-4 shadow-soft typing-bubble">
          <div class="flex items-center gap-2">
            <span class="typing-dot w-2.5 h-2.5 rounded-full bg-accent"></span>
            <span class="typing-dot w-2.5 h-2.5 rounded-full bg-accent"></span>
            <span class="typing-dot w-2.5 h-2.5 rounded-full bg-accent"></span>
            <span class="typing-dot w-2.5 h-2.5 rounded-full bg-accent"></span>
            <span class="text-sm text-text-secondary ml-1 font-medium">${currentLanguage === 'id' ? 'ChefBot sedang memproses…' : 'ChefBot is processing…'}</span>
          </div>
        </div>
      `;
      messagesEl.appendChild(typingNode);
      scrollToBottom();
    }
  }

  const COPY_ICON = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';
  const CHECK_ICON = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';

  function addMessage(content, role, denied) {
    const wrap = document.createElement('div');
    wrap.className = 'flex gap-4 max-w-2xl ' + (role === 'user' ? 'flex-row-reverse ml-auto' : '');
    wrap.setAttribute('role', 'listitem');

    const avatar = document.createElement('div');
    avatar.className = 'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-soft overflow-hidden';
    avatar.setAttribute('aria-hidden', 'true');
    if (role === 'user') {
      avatar.classList.add('bg-surface');
      avatar.innerHTML = USER_ICON;
    } else {
      avatar.classList.add('bg-chefbot');
      avatar.innerHTML = '<span class="text-xl">👨‍🍳</span>';
    }

    const bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'flex-1 msg-bubble-wrap';

    const bubble = document.createElement('div');
    bubble.className = 'rounded-2xl px-5 py-4 shadow-soft msg-' + (role === 'user' ? 'user' : 'bot');
    if (denied) bubble.classList.add('msg-denied');

    const text = document.createElement('div');
    text.className = 'text-[15px] text-text-primary break-words msg-content leading-relaxed pr-10';
    if (role === 'bot' && !denied) {
      text.innerHTML = markdownToHtml(content);
      text.classList.add('msg-markdown');
    } else {
      text.textContent = content;
    }

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'msg-copy-btn';
    copyBtn.innerHTML = COPY_ICON;
    copyBtn.setAttribute('aria-label', currentLanguage === 'id' ? 'Salin' : 'Copy');
    copyBtn.addEventListener('click', function () {
      const plainText = getPlainTextFromElement(text);
      if (!plainText) return;
      navigator.clipboard.writeText(plainText).then(function () {
        copyBtn.innerHTML = CHECK_ICON;
        copyBtn.classList.add('copied');
        copyBtn.setAttribute('aria-label', currentLanguage === 'id' ? 'Tersalin!' : 'Copied!');
        setTimeout(function () {
          copyBtn.innerHTML = COPY_ICON;
          copyBtn.classList.remove('copied');
          copyBtn.setAttribute('aria-label', currentLanguage === 'id' ? 'Salin' : 'Copy');
        }, 2000);
      }).catch(function () {
        try {
          const ta = document.createElement('textarea');
          ta.value = plainText;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          copyBtn.innerHTML = CHECK_ICON;
          copyBtn.classList.add('copied');
          setTimeout(function () {
            copyBtn.innerHTML = COPY_ICON;
            copyBtn.classList.remove('copied');
          }, 2000);
        } catch (_) {}
      });
    });

    bubble.appendChild(text);
    bubble.appendChild(copyBtn);
    bubbleWrap.appendChild(bubble);
    wrap.appendChild(avatar);
    wrap.appendChild(bubbleWrap);
    messagesEl.appendChild(wrap);
    scrollToBottom();
  }

  function setSendEnabled(enabled) {
    sendBtn.disabled = !enabled;
    input.disabled = !enabled;
  }

  async function submitMessage(text) {
    const raw = typeof text === 'string' ? text.trim() : input.value.trim();
    if (!raw) return;

    const apiKey = await loadEnv();
    if (!apiKey) {
      addMessage(currentLanguage === 'id' ? 'API key belum terbaca. Pastikan: (1) Buka via Live Server (bukan file://), (2) File config.env ada di folder yang sama dengan index.html, (3) Isi: RAPIDAPI_KEY=your_key' : 'API key not found. Ensure: (1) Open via Live Server (not file://), (2) config.env exists in same folder as index.html, (3) Format: RAPIDAPI_KEY=your_key', 'bot', true);
      return;
    }
    const domain = checkDomain(raw);
    if (!domain.allowed) {
      addMessage(domain.message, 'bot', true);
      return;
    }

    input.value = '';
    addMessage(raw, 'user');
    setTyping(true);
    setSendEnabled(false);

    try {
      const ctx = getSessionContext();
      const system = buildSystemPrompt(currentMode, currentLanguage);
      const userContent = buildUserMessage(raw, currentMode, currentLanguage);
      const contextStr = ctx.length > 0 ? '\n\n[Previous]\n' + ctx.map(m => (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content).join('\n\n') : '';
      const fullContent = system + contextStr + '\n\n[Current]\n' + userContent;

      const res = await fetch(RAPIDAPI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': RAPIDAPI_HOST },
        body: JSON.stringify({ messages: [{ role: 'user', content: fullContent }], model: 'gpt-4o-mini' })
      });

      const rawText = await res.text();
      let data = {};
      try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = {}; }
      const reply = extractRapidAPIResponse(data);

      if (!res.ok) {
        addMessage('Sorry, I couldn\'t reach the kitchen assistant. ' + (data.message || data.error || `HTTP ${res.status}`), 'bot', true);
        return;
      }
      if (!reply) {
        addMessage(currentLanguage === 'id' ? 'Respons kosong. Cek RAPIDAPI_KEY dan subscription di rapidapi.com.' : 'Empty response. Check RAPIDAPI_KEY and subscription at rapidapi.com.', 'bot', true);
        return;
      }

      let cleanedReply = cleanApiFooter(reply);
      if (isGreetingResponse(cleanedReply)) cleanedReply = getRedirectMsg();
      addMessage(cleanedReply, 'bot', false);
      ctx.push({ role: 'user', content: raw });
      ctx.push({ role: 'assistant', content: cleanedReply });
      setSessionContext(ctx);
    } catch (err) {
      addMessage((currentLanguage === 'id' ? 'Koneksi gagal: ' : 'Connection failed: ') + (err.message || 'Network error'), 'bot', true);
    } finally {
      setTyping(false);
      setSendEnabled(true);
      input.focus();
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    submitMessage();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // Auto-resize textarea: min ~48px, max ~70% viewport (expands for very long paste)
  function resizeInput() {
    input.style.height = 'auto';
    const maxH = Math.min(320, Math.floor(window.innerHeight * 0.28));
    input.style.height = Math.min(Math.max(input.scrollHeight, 24), maxH) + 'px';
  }
  input.addEventListener('input', resizeInput);
  input.addEventListener('paste', function () {
    setTimeout(resizeInput, 0);
  });

  // Suggested questions
  document.querySelectorAll('.suggested-q').forEach(btn => {
    btn.addEventListener('click', function () {
      const q = this.getAttribute('data-q');
      if (q) {
        submitMessage(q);
        if (window.innerWidth < 1024) closeSidebars();
      }
    });
  });

  // Clear chat: show confirmation modal first
  document.getElementById('btn-clear-chat')?.addEventListener('click', showClearChatModal);
  document.getElementById('btn-clear-chat-collapsed')?.addEventListener('click', showClearChatModal);

  // How to use (collapsed sidebar)
  document.getElementById('btn-how-to-use-collapsed')?.addEventListener('click', showHowToUse);

  function showClearChatModal() {
    const modal = document.getElementById('modal-clear');
    if (modal) {
      modal.classList.remove('hidden');
      document.getElementById('modal-clear-cancel')?.focus();
    }
    if (window.innerWidth < 1024) closeSidebars();
  }

  function hideClearChatModal() {
    document.getElementById('modal-clear')?.classList.add('hidden');
  }

  document.getElementById('modal-clear-cancel')?.addEventListener('click', hideClearChatModal);
  document.getElementById('modal-clear-confirm')?.addEventListener('click', function () {
    hideClearChatModal();
    clearContext();
  });

  document.getElementById('modal-clear')?.addEventListener('click', function (e) {
    if (e.target === this) hideClearChatModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!document.getElementById('modal-clear')?.classList.contains('hidden')) hideClearChatModal();
      if (!document.getElementById('modal-howto')?.classList.contains('hidden')) hideHowToUseModal();
    }
  });

  // How to use: show popup modal
  document.getElementById('btn-how-to-use')?.addEventListener('click', showHowToUse);

  function showHowToUse() {
    const modal = document.getElementById('modal-howto');
    if (modal) {
      modal.classList.remove('hidden');
      document.getElementById('modal-howto-close')?.focus();
    }
    if (window.innerWidth < 1024) closeSidebars();
  }

  function hideHowToUseModal() {
    document.getElementById('modal-howto')?.classList.add('hidden');
  }

  document.getElementById('modal-howto-close')?.addEventListener('click', hideHowToUseModal);
  document.getElementById('modal-howto')?.addEventListener('click', function (e) {
    if (e.target === this) hideHowToUseModal();
  });

  // Mode, Language & Service handlers
  function showConfigLoading(text) {
    const overlay = document.getElementById('config-loading');
    const textEl = overlay?.querySelector('p');
    if (textEl) textEl.textContent = text || 'Applying configuration…';
    if (overlay) overlay.classList.remove('hidden');
  }

  function hideConfigLoading() {
    const overlay = document.getElementById('config-loading');
    if (overlay) overlay.classList.add('hidden');
  }

  function applyConfigWithLoading(callback) {
    showConfigLoading('Applying configuration…');
    setTimeout(() => {
      if (typeof callback === 'function') callback();
      hideConfigLoading();
    }, 600);
  }

  document.querySelectorAll('.mode-tag-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const mode = this.getAttribute('data-mode');
      if (!mode) return;
      applyConfigWithLoading(() => {
        currentMode = mode;
        document.querySelectorAll('.mode-tag-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
      });
    });
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const lang = this.getAttribute('data-lang');
      if (!lang) return;
      applyConfigWithLoading(() => {
        currentLanguage = lang;
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        updateQuickActionLabels();
        updateTipLabels();
      });
    });
  });

  function updateQuickActionLabels() {
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
      const label = btn.querySelector('.quick-action-label');
      if (label) label.textContent = currentLanguage === 'id' ? (btn.getAttribute('data-label-id') || '') : (btn.getAttribute('data-label-en') || '');
    });
  }
  function updateTipLabels() {
    const tips = {
      en: ['Prevent onion tears', 'Store herbs longer', 'Chicken safe temp', 'Fluffy rice'],
      id: ['Cegah bawang bikin menangis', 'Simpan herbal tahan lama', 'Suhu aman ayam', 'Nasi pulen']
    };
    const arr = currentLanguage === 'id' ? tips.id : tips.en;
    document.querySelectorAll('.tip-btn .tip-label').forEach((el, i) => { if (arr[i]) el.textContent = arr[i]; });
  }

  document.querySelectorAll('.quick-action-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const q = currentLanguage === 'id' ? this.getAttribute('data-q-id') : this.getAttribute('data-q-en');
      if (q) { submitMessage(q); if (window.innerWidth < 1024) closeSidebars(); }
    });
  });

  document.querySelectorAll('.tip-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const q = currentLanguage === 'id' ? this.getAttribute('data-tip-id') : this.getAttribute('data-tip-en');
      if (q) { submitMessage(q); if (window.innerWidth < 1024) closeSidebars(); }
    });
  });

  function runConverter() {
    const inp = document.getElementById('conv-input');
    const out = document.getElementById('conv-result');
    const from = document.getElementById('conv-from')?.value;
    const to = document.getElementById('conv-to')?.value;
    const val = parseFloat(inp?.value) || 0;
    if (!from || !to || !out) return;
    let result = null;
    if (from === to) result = val;
    else if (from === 'tbsp' && to === 'cup') result = val / 16;
    else if (from === 'cup' && to === 'tbsp') result = val * 16;
    else if (from === 'g' && to === 'oz') result = val / 28.35;
    else if (from === 'oz' && to === 'g') result = val * 28.35;
    else if (from === 'c' && to === 'f') result = (val * 9/5) + 32;
    else if (from === 'f' && to === 'c') result = (val - 32) * 5/9;
    out.value = result !== null && !isNaN(result) ? (result < 0.01 && result > 0 ? result.toFixed(4) : result.toFixed(2)) : '—';
  }
  document.getElementById('conv-input')?.addEventListener('input', runConverter);
  document.getElementById('conv-from')?.addEventListener('change', runConverter);
  document.getElementById('conv-to')?.addEventListener('change', runConverter);
  runConverter();

  // Set initial active states
  document.querySelector(`.mode-tag-btn[data-mode="${currentMode}"]`)?.classList.add('active');
  document.querySelector(`.lang-btn[data-lang="${currentLanguage}"]`)?.classList.add('active');

  // Clear context (local only)
  function clearContext() {
    setSessionContext([]);
    const welcome = messagesEl.querySelector('div:first-child');
    const clone = welcome ? welcome.cloneNode(true) : null;
    messagesEl.innerHTML = '';
    if (clone) messagesEl.appendChild(clone);
    if (window.innerWidth < 1024) closeSidebars();
  }

  // Sidebar toggle: expand/collapse with narrow strip when collapsed
  const sidebarLeft = document.getElementById('sidebar-left');
  const sidebarRight = document.getElementById('sidebar-right');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const btnExpandSidebar = document.getElementById('btn-expand-sidebar');
  const btnToggleLeft = document.getElementById('btn-toggle-left');
  const btnToggleRight = document.getElementById('btn-toggle-right');

  function closeSidebars() {
    if (sidebarLeft) {
      sidebarLeft.classList.remove('open');
      sidebarLeft.classList.add('collapsed');
    }
    if (sidebarRight) sidebarRight.classList.remove('open');
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.classList.remove('visible');
  }

  function openSidebarLeft() {
    if (sidebarLeft) {
      sidebarLeft.classList.add('open');
      sidebarLeft.classList.remove('collapsed');
    }
    if (sidebarRight) sidebarRight.classList.remove('open');
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.classList.add('visible');
  }

  function openSidebarRight() {
    if (sidebarRight) sidebarRight.classList.add('open');
    if (sidebarLeft) {
      sidebarLeft.classList.remove('open');
      sidebarLeft.classList.add('collapsed');
    }
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.classList.add('visible');
  }

  function toggleSidebarLeft() {
    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      if (sidebarLeft?.classList.contains('open')) {
        closeSidebars();
      } else {
        openSidebarLeft();
      }
    } else {
      sidebarLeft?.classList.toggle('collapsed');
    }
  }

  if (btnToggleSidebar) btnToggleSidebar.addEventListener('click', toggleSidebarLeft);
  if (btnExpandSidebar) btnExpandSidebar.addEventListener('click', () => sidebarLeft?.classList.remove('collapsed'));
  if (btnToggleLeft) btnToggleLeft.addEventListener('click', openSidebarLeft);
  if (btnToggleRight) btnToggleRight.addEventListener('click', function () {
    if (window.innerWidth < 1024) {
      if (sidebarRight?.classList.contains('open')) closeSidebars();
      else openSidebarRight();
    }
  });

  // Overlay close
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebars);

  // New Chat link in header (optional - add if we have a header link)
  window.chefbotClearContext = clearContext;

})();
