(function () {
  const form = document.getElementById('bootstrap-form');
  const toast = document.getElementById('toast');

  function showToast(msg) {
    toast.textContent = msg;
    toast.setAttribute('aria-hidden', 'false');
    toast.classList.add('is-open');
    setTimeout(() => toast.classList.remove('is-open'), 2400);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get('email') || '');
    const password = String(fd.get('password') || '');
    const token = String(fd.get('token') || '');

    const res = await fetch('/auth/bootstrap-admin', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-bootstrap-token': token,
      },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        json && json.messages && json.messages[0] ? json.messages[0] : '실패';
      showToast(msg);
      return;
    }

    showToast('관리자 생성 완료. 로그인 페이지로 이동합니다.');
    setTimeout(() => (location.href = '/owner/login'), 900);
  });
})();
