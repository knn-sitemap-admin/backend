(function () {
  const form = document.getElementById('reset-form');
  const toast = document.getElementById('toast');

  function showToast(msg) {
    toast.textContent = msg;
    toast.setAttribute('aria-hidden', 'false');
    toast.classList.add('is-open');
    setTimeout(() => toast.classList.remove('is-open'), 2600);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get('email') || '');
    const newPassword = String(fd.get('newPassword') || '');
    const token = String(fd.get('token') || '');

    const res = await fetch('/auth/admin/reset-password-with-token', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-bootstrap-token': token,
      },
      body: JSON.stringify({ email, newPassword }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        json && json.messages && json.messages[0] ? json.messages[0] : '실패';
      showToast(msg);
      return;
    }
    showToast('비밀번호 재설정 완료');
  });
})();
