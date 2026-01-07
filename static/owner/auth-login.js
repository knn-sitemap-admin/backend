(function () {
  const form = document.getElementById('login-form');
  const toast = document.getElementById('toast');

  function showToast(msg) {
    toast.textContent = msg;
    toast.setAttribute('aria-hidden', 'false');
    toast.classList.add('is-open');
    setTimeout(() => toast.classList.remove('is-open'), 2200);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get('email') || '');
    const password = String(fd.get('password') || '');

    const res = await fetch('/auth/signin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        json && json.messages && json.messages[0]
          ? json.messages[0]
          : '로그인 실패';
      showToast(msg);
      return;
    }

    // 로그인 성공 -> owner 메인
    location.href = '/owner';
  });
})();
