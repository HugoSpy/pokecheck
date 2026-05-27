const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.pokecheck.fr';

interface Props {
  message?: string;
}

export default function MicrosoftLoginButton({ message }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '50vh', gap: 24,
    }}>
      {message && (
        <p style={{
          fontFamily: 'var(--font-condensed)', fontSize: 15,
          color: 'var(--text-secondary)', letterSpacing: '0.04em',
          textAlign: 'center', maxWidth: 360,
        }}>{message}</p>
      )}
      <a
        href={`${API_URL}/auth/microsoft`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          padding: '12px 28px',
          background: '#fff', color: '#1a1a1a',
          fontFamily: 'var(--font-condensed)', fontSize: 15, fontWeight: 700,
          letterSpacing: '0.04em', textDecoration: 'none',
          borderRadius: 'var(--radius)', border: '1px solid #ddd',
          transition: 'all 200ms ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'; }}
      >
        <MicrosoftLogo />
        Se connecter avec Microsoft
      </a>
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}
