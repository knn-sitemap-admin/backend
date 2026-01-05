(function () {
  function safe(v) {
    return v === null || v === undefined ? '' : String(v);
  }

  function statusText(pc, mobile) {
    const pcOn = !!(pc && pc.isActive);
    const moOn = !!(mobile && mobile.isActive);
    if (pcOn && moOn) return 'PC+Mobile';
    if (pcOn) return 'PC';
    if (moOn) return 'Mobile';
    return '-';
  }

  function statusBadge(pc, mobile) {
    const t = statusText(pc, mobile);
    if (t === 'PC+Mobile')
      return `<span class="badge badge--warn">PC+Mobile</span>`;
    if (t === 'PC') return `<span class="badge badge--ok">PC</span>`;
    if (t === 'Mobile') return `<span class="badge badge--ok">Mobile</span>`;
    return `<span class="badge">-</span>`;
  }

  async function ensureCssOnce(href) {
    const exists = document.querySelector(`link[data-owner-href="${href}"]`);
    if (exists) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-owner-href', href);
    document.head.appendChild(link);
  }

  function openLogoutModal(
    modalRoot,
    { credentialId, pcActive, mobileActive, onChoose },
  ) {
    const pcBtn = pcActive
      ? `<button class="btn btn--ghost" data-logout="pc" data-cid="${credentialId}">PC 로그아웃</button>`
      : '';
    const moBtn = mobileActive
      ? `<button class="btn btn--ghost" data-logout="mobile" data-cid="${credentialId}">Mobile 로그아웃</button>`
      : '';
    const allBtn =
      pcActive && mobileActive
        ? `<button class="btn" data-logout="all" data-cid="${credentialId}">전체 로그아웃</button>`
        : '';

    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-close="1"></div>
      <div class="modal modal--small" role="dialog" aria-modal="true">
        <div class="modal__header">
          <div class="modal__title">강제 로그아웃</div>
          <button class="icon-btn" data-close="1">×</button>
        </div>
        <div class="card__body" style="padding:14px;">
          <div class="muted" style="margin-bottom:12px;">
            현재 활성 세션만 선택할 수 있습니다.
          </div>
          <div class="row" style="gap:10px; flex-wrap:wrap;">
            ${pcBtn}
            ${moBtn}
            ${allBtn}
            <button class="btn btn--ghost" data-close="1">취소</button>
          </div>
        </div>
      </div>
    `;

    for (const el of modalRoot.querySelectorAll('[data-close="1"]')) {
      el.addEventListener('click', () => {
        modalRoot.innerHTML = '';
      });
    }

    const btns = modalRoot.querySelectorAll('button[data-logout]');
    for (const b of btns) {
      b.addEventListener('click', () => {
        const cid = b.getAttribute('data-cid');
        const device = b.getAttribute('data-logout');
        if (!cid || !device) return;
        modalRoot.innerHTML = '';
        onChoose(cid, device);
      });
    }
  }

  async function forceSignout({ credentialId, deviceType }) {
    const res = await fetch(`/owner/api/employees/force-logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialId, deviceType }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.message ?? '강제 로그아웃 실패');
      return false;
    }
    return true;
  }

  async function fetchSessions({ page, pageSize }) {
    // API는 기존 그대로 사용. (서버에서 onlyActive 지원하면 여기에 onlyActive=1 붙이면 됨)
    const res = await fetch(
      `/owner/api/employees/sessions?page=${page}&pageSize=${pageSize}`,
      { credentials: 'include' },
    );
    const json = await res.json();
    return { res, json };
  }

  async function render({ box, modalRoot, page, pageSize }) {
    box.innerHTML = `
      <div class="table-loading">
        <div class="spinner"></div>
        <div class="table-loading__text">불러오는 중...</div>
      </div>
    `;

    const { res, json } = await fetchSessions({ page, pageSize });
    if (!res.ok) {
      box.innerHTML = `<div class="muted">불러오기 실패</div>`;
      return { totalPages: 1, rows: [] };
    }

    const data = json.data || {};
    const rowsRaw = data.items || [];

    // 활성 세션만 표시(프론트 필터)
    const rows = rowsRaw.filter((r) => {
      const pc = r.sessions ? r.sessions.pc : null;
      const mo = r.sessions ? r.sessions.mobile : null;
      return !!(pc && pc.isActive) || !!(mo && mo.isActive);
    });

    // 페이지 라벨: total은 서버 기준이라 정확하지 않을 수 있음
    const label = document.getElementById('employee-sessions-page-label');
    if (label) label.textContent = `${page} (active ${rows.length})`;

    let html = '';
    html += `<table class="table table--compact">`;
    html += `<thead><tr>`;
    html += `<th style="width:72px;">cid</th>`;
    html += `<th style="width:140px;">직급</th>`;
    html += `<th>email</th>`;
    html += `<th style="width:90px;">role</th>`;
    html += `<th style="width:120px;">상태</th>`;
    html += `<th style="width:160px;">PC last</th>`;
    html += `<th style="width:160px;">Mobile last</th>`;
    html += `<th style="width:120px;">action</th>`;
    html += `</tr></thead><tbody>`;

    for (const r of rows) {
      const pc = r.sessions ? r.sessions.pc : null;
      const mo = r.sessions ? r.sessions.mobile : null;
      const cid = safe(r.credentialId);

      const pcActive = pc && pc.isActive ? '1' : '0';
      const moActive = mo && mo.isActive ? '1' : '0';

      html += `<tr>`;
      html += `<td>${cid}</td>`;
      html += `<td>${safe(r.positionRank)}</td>`;
      html += `<td class="td-ellipsis" title="${safe(r.email)}">${safe(r.email)}</td>`;
      html += `<td>${safe(r.role)}</td>`;
      html += `<td>${statusBadge(pc, mo)}</td>`;
      html += `<td>${safe(pc && pc.lastAccessedAt)}</td>`;
      html += `<td>${safe(mo && mo.lastAccessedAt)}</td>`;
      html += `<td>
        <button class="btn btn--ghost" data-action="logout-modal"
          data-cid="${cid}"
          data-pc="${pcActive}"
          data-mo="${moActive}"
        >로그아웃</button>
      </td>`;
      html += `</tr>`;
    }

    html += `</tbody></table>`;
    box.innerHTML = html;

    // 버튼 바인딩
    const btns = box.querySelectorAll('button[data-action="logout-modal"]');
    for (const b of btns) {
      b.addEventListener('click', () => {
        const cid = b.getAttribute('data-cid');
        const pcActive = b.getAttribute('data-pc') === '1';
        const moActive = b.getAttribute('data-mo') === '1';
        if (!cid) return;

        openLogoutModal(modalRoot, {
          credentialId: cid,
          pcActive,
          mobileActive: moActive,
          onChoose: async (credentialId, deviceType) => {
            const ok = await forceSignout({ credentialId, deviceType });
            if (ok) {
              await render({ box, modalRoot, page, pageSize });
            }
          },
        });
      });
    }

    const exportA = document.getElementById('employee-sessions-export');
    if (exportA) exportA.href = `/owner/api/employees/sessions/export.xlsx`;

    // 서버 totalPages는 active 기준이 아니라서 여기서는 페이지 버튼은 그냥 유지/완화
    const totalPages = Math.max(
      1,
      Math.ceil((data.total || 0) / (data.pageSize || pageSize)),
    );
    return { totalPages, rows };
  }

  async function init({ modalRootId, tableId }) {
    await ensureCssOnce('/owner/employee-sessions.css');

    const modalRoot = document.getElementById(modalRootId);
    const box = document.getElementById(tableId);
    if (!box || !modalRoot) return;

    let page = Number(box.getAttribute('data-page') || '1');
    const pageSize = Number(box.getAttribute('data-page-size') || '20');

    const prevBtn = document.getElementById('employee-sessions-prev');
    const nextBtn = document.getElementById('employee-sessions-next');

    async function rerender() {
      const { totalPages } = await render({ box, modalRoot, page, pageSize });
      if (prevBtn) prevBtn.disabled = page <= 1;
      if (nextBtn) nextBtn.disabled = page >= totalPages;
    }

    if (prevBtn) {
      prevBtn.onclick = () => {
        if (page > 1) {
          page--;
          rerender();
        }
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        page++;
        rerender();
      };
    }

    await rerender();
  }

  window.OwnerEmployeeSessions = { init };
})();
