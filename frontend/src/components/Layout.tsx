import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../api/client';
import { generateAdminPack } from '../api/adminApi';
import { getAttendanceAvailable } from '../api/attendanceApi';
import { useUserCtx } from '../context/UserContext';
import BadgeNotification from './BadgeNotification';
import { Coins, Grid, Swap, ShoppingBag, Calendar, User, Pokeball } from './icons';
import { isDevEnv } from '../data/patchnotes';
import './Layout.css';

const NAV_LINKS = [
  { to: '/open',        label: 'Ouvrir'     },
  { to: '/pokedex',     label: 'Pokédex'    },
  { to: '/trades',      label: 'Échanges'   },
  { to: '/market',      label: 'Marché'     },
  { to: '/events',      label: 'Événements' },
  { to: '/leaderboard', label: 'Classement' },
  { to: '/profile',     label: 'Profil'     },
];

// Mobile bottom nav. Classement stays reachable via the top logo.
const BOTTOM_NAV = [
  { to: '/pokedex', label: 'Pokédex',  Icon: Grid        },
  { to: '/trades',  label: 'Échanges', Icon: Swap        },
  { to: '/open',    label: 'Ouvrir',   Icon: Pokeball    },
  { to: '/market',  label: 'Marché',   Icon: ShoppingBag },
  { to: '/events',  label: 'Events',   Icon: Calendar    },
  { to: '/profile', label: 'Profil',   Icon: User        },
];

export default function Layout() {
  const navigate = useNavigate();
  const { profile: user, coins, authenticated, clearProfile } = useUserCtx();
  const isAdmin = user?.is_admin === true;

  const [showModal, setShowModal] = useState(false);
  const [forceShiny, setForceShiny] = useState(false);
  const [packLoading, setPackLoading] = useState(false);

  // Attendance availability — poll every 15s, dot on "Ouvrir", toast on new check
  const [attAvailable, setAttAvailable] = useState(false);
  const [attToast, setAttToast] = useState(false);
  const prevAvailRef = useRef<boolean | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    async function poll() {
      try {
        const a = await getAttendanceAvailable();
        if (cancelled) return;
        setAttAvailable(a.available);
        if (prevAvailRef.current === false && a.available) {
          setAttToast(true);
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setAttToast(false), 5000);
        }
        prevAvailRef.current = a.available;
      } catch { /* ignore */ }
    }
    poll();
    const i = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(i);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [authenticated]);

  async function handleLogout() {
    await logout().catch(() => {});
    clearProfile();
    window.location.reload();
  }

  async function handleOpenPack() {
    setPackLoading(true);
    try {
      const { code } = await generateAdminPack(forceShiny);
      setShowModal(false);
      setForceShiny(false);
      navigate(`/open?code=${code}`);
    } catch {
      // modal stays open on error
    } finally {
      setPackLoading(false);
    }
  }

  return (
    <div className={`layout${isDevEnv ? ' layout--dev' : ''}`}>
      {isDevEnv && (
        <div className="dev-banner">
          ⚠️ Environnement de développement — api-dev.pokecheck.fr
        </div>
      )}
      <nav className="nav">
        <NavLink to="/leaderboard" className="nav-logo">
          <span className="nav-logo-pk">Poké</span>
          <span className="nav-logo-check">Check</span>
        </NavLink>

        <div className="nav-links">
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}${link.to === '/open' ? ' nav-link-open' : ''}`}
            >
              {link.label}
              {link.to === '/open' && attAvailable && <span className="nav-dot" aria-label="Pack disponible" />}
            </NavLink>
          ))}
        </div>

        <div className="nav-user">
          {isAdmin && (
            <>
              <NavLink to="/admin/attendance" className="btn btn-ghost nav-admin-btn">
                Check présence
              </NavLink>
              <button className="btn btn-ghost nav-admin-btn" onClick={() => setShowModal(true)}>
                Ouvrir un pack
              </button>
            </>
          )}
          {user ? (
            <>
              <span className="nav-coins"><Coins size={14} /> {coins.toLocaleString()}</span>
              <span className="nav-username">
                {user.display_name}
                {isAdmin && <span className="nav-admin-badge">ADMIN</span>}
              </span>
              <button className="btn btn-ghost nav-logout" onClick={handleLogout}>
                Déconnexion
              </button>
            </>
          ) : (
            <a
              href={`${import.meta.env.VITE_API_URL ?? 'https://api.pokecheck.fr'}/auth/microsoft`}
              className="btn btn-primary nav-login"
            >
              <MsIcon /> Connexion
            </a>
          )}
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Navigation">
        {BOTTOM_NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <span className="bottom-nav-icon-wrap">
              <Icon size={22} />
              {to === '/open' && attAvailable && <span className="nav-dot bottom-nav-dot" />}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {attToast && (
        <div className="att-toast" role="status" onClick={() => setAttToast(false)}>
          🎁 Un nouveau pack t'attend ! Va l'ouvrir avant qu'il n'expire.
        </div>
      )}

      <BadgeNotification />

      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-title">Ouvrir un pack</div>
            <label className="admin-modal-shiny">
              <input
                type="checkbox"
                checked={forceShiny}
                onChange={e => setForceShiny(e.target.checked)}
              />
              Force Shiny ✨
            </label>
            <div className="admin-modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={handleOpenPack} disabled={packLoading}>
                {packLoading ? 'Génération…' : 'Ouvrir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 21 21" style={{ flexShrink: 0 }}>
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}
