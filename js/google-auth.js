// Mounts Google Sign-In button. Pass the role ('customer'|'seller') we want
// to associate the new account with on first sign-in.
async function mountGoogleButton(elId, role) {
  const cfg = await fetch('/api/config').then(r => r.json()).catch(() => ({}));
  const clientId = cfg.googleClientId;
  const wrap = document.getElementById(elId);
  if (!clientId) {
    wrap.innerHTML = `<div style="font-size:12px;color:#6b7280;text-align:center;padding:8px;border:1px dashed #e5e7eb;border-radius:8px">Google Sign-In not configured. Set <code>GOOGLE_CLIENT_ID</code> in backend/.env</div>`;
    return;
  }
  // Wait for the GSI script to load
  await waitFor(() => window.google && window.google.accounts);
  google.accounts.id.initialize({
    client_id: clientId,
    callback: async (resp) => {
      try {
        const data = await api('/auth/google', {
          method: 'POST',
          body: JSON.stringify({ credential: resp.credential, role }),
        });
        setSession(data.token, data.user);
        toast('Signed in with Google');
        setTimeout(() => {
          window.location.href = data.user.role === 'seller' ? '/seller-dashboard.html' : '/index.html';
        }, 400);
      } catch (e) {
        const errEl = document.getElementById('errorBox');
        if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
      }
    },
  });
  google.accounts.id.renderButton(wrap, {
    theme: 'outline', size: 'large', width: 360, text: 'continue_with',
  });
}

function waitFor(fn, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (fn()) { clearInterval(t); resolve(); }
      else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('timeout')); }
    }, 50);
  });
}
