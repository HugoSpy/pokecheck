import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { UserProvider, useUserCtx } from './context/UserContext';
import { TradeAnimProvider } from './context/TradeAnimContext';
import Login from './pages/Login';
import OpenPack from './pages/OpenPack';
import EventPackOpen from './pages/EventPackOpen';
import Pokedex from './pages/Pokedex';
import Trades from './pages/Trades';
import Leaderboard from './pages/Leaderboard';
import UserPokedex from './pages/UserPokedex';
import DevTradeAnim from './pages/DevTradeAnim';
import Market from './pages/Market';
import Events from './pages/Events';
import Profile from './pages/Profile';
import AdminAttendance from './pages/AdminAttendance';
import Layout from './components/Layout';
import PatchNotesButton from './components/PatchNotesButton';

function AppRoutes() {
  const location = useLocation();
  const { profile, loading, authenticated } = useUserCtx();
  const isPublicPackRoute = location.pathname === '/open' || location.pathname === '/events/pack';
  const isDevTradeAnim = location.pathname === '/dev/trade-anim';
  const isAdmin = profile?.is_admin === true;

  if (loading && !isPublicPackRoute) return null;

  if (!authenticated && !isPublicPackRoute && !isDevTradeAnim) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/open" element={<OpenPack />} />
      <Route path="/events/pack" element={<EventPackOpen />} />
      <Route element={<Layout />}>
        <Route path="/pokedex"     element={<Pokedex />} />
        <Route path="/trades"      element={<Trades />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/u/:id"       element={<UserPokedex />} />
        <Route path="/market"      element={<Market />} />
        <Route path="/events"      element={<Events />} />
        <Route path="/profile"     element={<Profile />} />
        <Route
          path="/admin/attendance"
          element={isAdmin ? <AdminAttendance /> : <Navigate to="/leaderboard" replace />}
        />
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
    if (params.has('session')) {
      // Legacy cleanup for old OAuth redirects. New sessions are HttpOnly cookies.
      params.delete('session');
      const clean = [window.location.pathname, params.toString() ? '?' + params.toString() : ''].join('');
      window.history.replaceState({}, '', clean);
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <BrowserRouter>
      <UserProvider>
        <TradeAnimProvider>
          <AppRoutes />
          <PatchNotesButton />
        </TradeAnimProvider>
      </UserProvider>
    </BrowserRouter>
  );
}
