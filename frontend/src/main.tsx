import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/globals.css';

import OpenPack from './pages/OpenPack';
import Pokedex from './pages/Pokedex';
import Trades from './pages/Trades';
import Leaderboard from './pages/Leaderboard';
import UserPokedex from './pages/UserPokedex';
import Layout from './components/Layout';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/open" element={<OpenPack />} />
        <Route element={<Layout />}>
          <Route path="/pokedex" element={<Pokedex />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/u/:id" element={<UserPokedex />} />
        </Route>
        <Route path="*" element={<Navigate to="/leaderboard" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
