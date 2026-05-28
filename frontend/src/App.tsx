import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { setToken, getToken } from './api';
import Login from './pages/Login';
import OpenPack from './pages/OpenPack';
import Pokedex from './pages/Pokedex';
import Trades from './pages/Trades';
import Leaderboard from './pages/Leaderboard';
import UserPokedex from './pages/UserPokedex';
import DevTradeAnim from './pages/DevTradeAnim';
import Layout from './components/Layout';

function parseJwt(token: string): { exp?: number; isAdmin?: boolean } | null {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const payload = parseJwt(token);
  if (!payload?.exp) return false;
  return Date.now() / 1000 < payload.exp;
}

function AppRoutes() {
  const location = useLocation();
  const authed = isTokenValid(getToken());

  const token = getToken();
  const isAdmin = authed && token !== null && (parseJwt(token)?.isAdmin === true);

  if (!authed && location.pathname !== '/open' && location.pathname !== '/dev/trade-anim') {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/open" element={<OpenPack />} />
      <Route element={<Layout />}>
        <Route path="/pokedex"     element={<Pokedex />} />
        <Route path="/trades"      element={<Trades />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/u/:id"       element={<UserPokedex />} />
      </Route>
      <Route
        path="/dev/trade-anim"
        element={isAdmin ? <DevTradeAnim /> : <Navigate to="/leaderboard" replace />}
      />
      <Route path="*" element={<Navigate to="/leaderboard" replace />} />
    </Routes>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionToken = params.get('session');
    if (sessionToken) {
      setToken(sessionToken);
      params.delete('session');
      const clean = [window.location.pathname, params.toString() ? '?' + params.toString() : ''].join('');
      window.history.replaceState({}, '', clean);
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
