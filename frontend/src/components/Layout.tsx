import { NavLink, Outlet } from 'react-router-dom';
import './Layout.css';

const NAV_LINKS = [
  { to: '/pokedex',     label: 'Pokédex'     },
  { to: '/trades',      label: 'Échanges'    },
  { to: '/leaderboard', label: 'Classement'  },
];

export default function Layout() {
  return (
    <div className="layout">
      <nav className="nav">
        <NavLink to="/leaderboard" className="nav-logo">
          <span className="nav-logo-pk">Poké</span>
          <span className="nav-logo-school">School</span>
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
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
