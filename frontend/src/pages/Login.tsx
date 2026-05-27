import './Login.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.pokecheck.fr';

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
