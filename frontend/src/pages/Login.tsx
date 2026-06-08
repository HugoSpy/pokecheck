import { DEV_TOKEN_STORAGE_KEY } from '../api/client';
import './Login.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.pokecheck.fr';

// [DEV ONLY - NEVER MERGE] logs in as a seeded test account via the
// /dev/test-login backdoor and stores the returned JWT in sessionStorage
// (instead of relying on the shared httpOnly session cookie), so each
// browser tab can independently be Test 1 or Test 2 — needed to test
// multi-player features like the Battle lobby.
async function loginAsTest(account: 1 | 2) {
  const res = await fetch(`${API_URL}/dev/test-login?account=${account}`);
  if (!res.ok) return;
  const { token } = await res.json() as { token: string };
  sessionStorage.setItem(DEV_TOKEN_STORAGE_KEY, token);
  window.location.href = '/';
}

export default function Login() {
  return (
    <div className="login-page">
      <div className="scanlines" />

      <div className="login-logo">
        <span className="login-logo-pk">Poké</span>
        <span className="login-logo-check">Check</span>
      </div>

      <div className="pokeball-wrap pulsing">
        <div className="pokeball">
          <div className="pokeball-top" />
          <div className="pokeball-band" />
          <div className="pokeball-bottom" />
          <div className="pokeball-center"><div className="pokeball-button" /></div>
        </div>
        <div className="pokeball-glow" />
      </div>

      <p className="login-subtitle">
        Connecte-toi avec ton compte EPITA pour accéder à ta collection Pokémon.
      </p>

      <a href={`${API_URL}/auth/microsoft`} className="ms-login-btn">
        <MsLogo />
        Se connecter avec Microsoft
      </a>

      {import.meta.env.VITE_DEV_BACKDOOR === 'true' && (
        <div className="dev-test-accounts">
          <p>— Dev only —</p>
          <button type="button" onClick={() => loginAsTest(1)} className="dev-test-account-btn">
            Connect as Test 1
          </button>
          <button type="button" onClick={() => loginAsTest(2)} className="dev-test-account-btn">
            Connect as Test 2
          </button>
        </div>
      )}
    </div>
  );
}

function MsLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
