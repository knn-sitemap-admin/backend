// 공통 fetch helper
async function postJson(url, body, extraHeaders) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.success === false) {
    const msg =
      data.messages?.join?.('\n') ||
      data.message ||
      '요청 중 오류가 발생했습니다.';
    throw new Error(msg);
  }

  return data;
}

// 로그인 폼
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
      await postJson('/auth/signin', { email, password });
      // 로그인 성공 시 대시보드로
      window.location.href = '/owner';
    } catch (err) {
      alert(err.message || '로그인 실패');
    }
  });
}

// 최초 관리자 부트스트랩 폼
const bootstrapForm = document.getElementById('bootstrapForm');
if (bootstrapForm) {
  bootstrapForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('baEmail').value.trim();
    const password = document.getElementById('baPassword').value;
    const token = document.getElementById('baToken').value;

    try {
      await postJson(
        '/auth/bootstrap-admin',
        { email, password },
        { 'x-bootstrap-token': token },
      );
      alert('관리자 계정이 설정되었습니다. 이제 로그인해주세요.');
      window.location.href = '/owner/login';
    } catch (err) {
      alert(err.message || '관리자 부트스트랩 실패');
    }
  });
}

// 토큰으로 비밀번호 재설정 폼
const resetWithTokenForm = document.getElementById('resetWithTokenForm');
if (resetWithTokenForm) {
  resetWithTokenForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('rpEmail').value.trim();
    const newPassword = document.getElementById('rpNewPassword').value;
    const token = document.getElementById('rpToken').value;

    try {
      await postJson(
        '/auth/admin/reset-password-with-token',
        { email, newPassword },
        { 'x-bootstrap-token': token },
      );
      alert('비밀번호가 재설정되었습니다. 다시 로그인해주세요.');
      window.location.href = '/owner/login';
    } catch (err) {
      alert(err.message || '비밀번호 재설정 실패');
    }
  });
}
