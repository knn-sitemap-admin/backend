(async function () {
  const contentEl = document.getElementById('owner-content');
  const modalRoot = document.getElementById('owner-modal-root');

  const titleEl = document.getElementById('topbar-title');
  const descEl = document.getElementById('topbar-desc');

  const tabMeta = {
    dashboard: {
      title: 'Dashboard',
      desc: '서버 상태와 운영 데이터를 확인합니다.',
    },
    'employee-sessions': {
      title: 'employee-sessions',
      desc: '현재 활성 로그인(PC/Mobile) 상태만 표시합니다.',
    },
    'api-logs': { title: 'API Logs', desc: '전체 API 요청 로그를 확인합니다.' },
    'error-logs': {
      title: 'Error Logs',
      desc: 'status_code >= 400 (4xx + 5xx) 에러 로그만 표시합니다.',
    },
  };

  async function fetchHtml(url) {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('fetch failed: ' + url);
    return await res.text();
  }

  function setActiveNav(tab) {
    const buttons = document.querySelectorAll('.nav__item[data-tab]');
    for (const btn of buttons) {
      const t = btn.getAttribute('data-tab');
      btn.classList.toggle('is-active', t === tab);
    }
    const meta = tabMeta[tab] || { title: tab, desc: '' };
    if (titleEl) titleEl.textContent = meta.title;
    if (descEl) descEl.textContent = meta.desc;
  }

  function ensureScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const exists = document.querySelector(`script[data-owner-src="${src}"]`);
      if (exists) return resolve();

      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.setAttribute('data-owner-src', src);
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('failed to load script: ' + src));
      document.head.appendChild(s);
    });
  }

  function bindSidebar() {
    const buttons = document.querySelectorAll('.nav__item[data-tab]');
    for (const btn of buttons) {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (!tab) return;
        history.replaceState(null, '', `/owner#${tab}`);
        loadTab(tab);
      });
    }
  }

  async function loadTab(tab, qs) {
    if (!contentEl) return;

    setActiveNav(tab);
    contentEl.innerHTML = `
      <div class="skeleton">
        <div class="skeleton__bar"></div>
        <div class="skeleton__bar"></div>
        <div class="skeleton__bar"></div>
      </div>
    `;

    const q = qs ? '?' + new URLSearchParams(qs).toString() : '';
    const html = await fetchHtml(`/owner/partials/${tab}${q}`);
    contentEl.innerHTML = html;

    // 탭별 초기화 (탭 전용 JS로 분리)
    if (tab === 'employee-sessions') {
      await ensureScriptOnce('/static/owner/employee-sessions.js');
      if (window.OwnerEmployeeSessions && window.OwnerEmployeeSessions.init) {
        await window.OwnerEmployeeSessions.init({
          modalRootId: 'owner-modal-root',
          tableId: 'employee-sessions-table',
        });
      }
      return;
    }

    if (tab === 'api-logs') {
      await ensureScriptOnce('/static/owner/api-logs.js');
      if (window.OwnerApiLogs && window.OwnerApiLogs.init) {
        await window.OwnerApiLogs.init({
          modalRootId: 'owner-modal-root',
          tableId: 'api-logs-table',
        });
      }
      return;
    }

    if (tab === 'error-logs') {
      await ensureScriptOnce('/static/owner/error-logs.js');
      if (window.OwnerErrorLogs && window.OwnerErrorLogs.init) {
        await window.OwnerErrorLogs.init({
          modalRootId: 'owner-modal-root',
          tableId: 'error-logs-table',
        });
      }
      return;
    }
  }

  bindSidebar();

  const appEl = document.querySelector('.app');
  const defaultTabFromDom = appEl
    ? appEl.getAttribute('data-default-tab')
    : null;

  const hashTab = (location.hash || '').replace('#', '').trim();
  const startTab = hashTab || defaultTabFromDom || 'dashboard';

  await loadTab(startTab);
})();
