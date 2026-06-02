import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getToken, clearToken } from '../api/client';
import { generateAdminPack } from '../api/adminApi';
import { useUserCtx } from '../context/UserContext';
import BadgeNotification from './BadgeNotification';
import { Coins, Grid, Swap, ShoppingBag, Calendar, User } from './icons';
import './Layout.css';

function parseJwt(token: string): { display_name?: string; isAdmin?: boolean } | null {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

const NAV_LINKS = [
  { to: '/pokedex',     label: 'Pokédex'    },
  { to: '/trades',      label: 'Échanges'   },
  { to: '/market',      label: 'Marché'     },
  { to: '/events',      label: 'Événements' },
  { to: '/leaderboard', label: 'Classement' },
  { to: '/profile',     label: 'Profil'     },
];

// Mobile bottom nav: 5 daily-use destinations. Classement stays reachable
// via the top logo (links to /leaderboard).
const BOTTOM_NAV = [
  { to: '/pokedex', label: 'Pokédex',  Icon: Grid        },
  { to: '/trades',  label: 'Échanges', Icon: Swap        },
  { to: '/market',  label: 'Marché',   Icon: ShoppingBag },
  { to: '/events',  label: 'Events',   Icon: Calendar    },
  { to: '/profile', label: 'Profil',   Icon: User        },
];

export default function Layout() {
  const navigate = useNavigate();
  const token = getToken();
  const user = token ? parseJwt(token) : null;
  const isAdmin = user?.isAdmin === true;
  const { coins } = useUserCtx();

  const [showModal, setShowModal] = useState(false);
  const [forceShiny, setForceShiny] = useState(false);
  const [packLoading, setPackLoading] = useState(false);

  function handleLogout() {
    clearToken();
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
    <div className="layout">
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
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="nav-user">
          {isAdmin && (
            <button className="btn btn-ghost nav-admin-btn" onClick={() => setShowModal(true)}>
              Ouvrir un pack
            </button>
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
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

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
