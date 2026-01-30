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

  const SESSION_HEADER = 'X-Session-Id';
  let sessionId = sessionStorage.getItem('chefbot-session') || crypto.randomUUID();
  sessionStorage.setItem('chefbot-session', sessionId);

  let currentService = 'api';
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

    const bubble = document.createElement('div');
    bubble.className = 'flex-1 rounded-2xl px-5 py-4 shadow-soft msg-' + (role === 'user' ? 'user' : 'bot');
    if (denied) bubble.classList.add('msg-denied');

    const text = document.createElement('div');
    text.className = 'text-[15px] leading-relaxed text-text-primary whitespace-pre-wrap break-words';
    text.textContent = content;

    bubble.appendChild(text);
    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
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

    input.value = '';
    addMessage(raw, 'user');
    setTyping(true);
    setSendEnabled(false);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [SESSION_HEADER]: sessionId
        },
        body: JSON.stringify({ message: raw, mode: currentMode, language: currentLanguage, service: currentService })
      });

      let data = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch (_) {
        data = { error: 'Invalid response', detail: `HTTP ${res.status}` };
      }

      if (!res.ok) {
        const errMsg = data.detail || data.error || data.message || `HTTP ${res.status}`;
        const hint = data.hint ? '\n\n' + data.hint : '';
        addMessage('Sorry, I couldn\'t reach the kitchen assistant. ' + errMsg + hint, 'bot', true);
        return;
      }

      addMessage(data.reply || '', 'bot', data.denied === true);
    } catch (err) {
      addMessage('Connection error. Is the app running? Try again. (Check that you are at http://localhost:3000)', 'bot', true);
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

  async function applyServiceWithLoading(newService, btn) {
    showConfigLoading('Verifying service…');
    try {
      const res = await fetch(`/api/service-check?service=${encodeURIComponent(newService)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        currentService = newService;
        document.querySelectorAll('.service-btn').forEach(b => b.classList.remove('active'));
        btn?.classList.add('active');
        const banner = document.getElementById('status-banner');
        const textEl = document.getElementById('status-text');
        if (newService === 'api') {
          banner?.classList.add('hidden');
        } else if (data.hint && data.modelPulled === false) {
          if (banner && textEl) {
            textEl.textContent = data.hint;
            banner.classList.remove('hidden');
          }
        } else {
          banner?.classList.add('hidden');
        }
        if (newService === 'docker') checkStatus();
      } else {
        const msg = data.hint || data.error || 'Service check failed';
        const banner = document.getElementById('status-banner');
        const textEl = document.getElementById('status-text');
        if (banner && textEl) {
          textEl.textContent = msg;
          banner.classList.remove('hidden');
        }
      }
    } catch (err) {
      const banner = document.getElementById('status-banner');
      const textEl = document.getElementById('status-text');
      if (banner && textEl) {
        textEl.textContent = 'Could not verify service. ' + (err.message || 'Network error');
        banner.classList.remove('hidden');
      }
    } finally {
      hideConfigLoading();
    }
  }

  document.querySelectorAll('.service-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const service = this.getAttribute('data-service');
      if (!service || service === currentService) return;
      applyServiceWithLoading(service, this);
    });
  });

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
      });
    });
  });

  // Set initial active states
  document.querySelector(`.service-btn[data-service="${currentService}"]`)?.classList.add('active');
  document.querySelector(`.mode-tag-btn[data-mode="${currentMode}"]`)?.classList.add('active');
  document.querySelector(`.lang-btn[data-lang="${currentLanguage}"]`)?.classList.add('active');

  // Clear context
  async function clearContext() {
    try {
      await fetch('/api/clear', {
        method: 'POST',
        headers: { [SESSION_HEADER]: sessionId }
      });
      const welcome = messagesEl.querySelector('div:first-child');
      const clone = welcome ? welcome.cloneNode(true) : null;
      messagesEl.innerHTML = '';
      if (clone) messagesEl.appendChild(clone);
      if (window.innerWidth < 1024) closeSidebars();
    } catch (_) {}
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

  // Check status on load (only show Ollama banner when using Docker service)
  async function checkStatus() {
    if (currentService !== 'docker') return;
    try {
      const res = await fetch('/api/status');
      const data = await res.json().catch(() => ({}));
      const banner = document.getElementById('status-banner');
      const textEl = document.getElementById('status-text');
      if (!banner || !textEl) return;

      if (data.ollama === 'unreachable' || data.ollama === 'error' || (data.ollama === 'ok' && !data.modelPulled)) {
        let msg = data.message || 'Ollama not ready.';
        if (data.hint) msg += ' ' + data.hint;
        textEl.textContent = msg;
        banner.classList.remove('hidden');
      }
    } catch (_) {}
  }

  checkStatus();

  document.getElementById('status-dismiss')?.addEventListener('click', function () {
    document.getElementById('status-banner')?.classList.add('hidden');
  });
})();
