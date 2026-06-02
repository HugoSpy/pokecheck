import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLeaderboard } from '../api/leaderboardApi';
import type { LeaderboardEntry } from '../api/types';
import './Leaderboard.css';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<'score' | 'coins'>('score');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    getLeaderboard(sort)
      .then(setEntries)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [sort]);

  if (error) return <div className="error-banner" style={{ margin: '40px auto', maxWidth: 500 }}>Erreur : {error}</div>;

  return (
    <div className="lb-page">
      <div className="lb-header">
        <div>
          <h1 className="lb-title">Classement</h1>
          <div className="lb-subtitle">Top 50 collectionneurs</div>
        </div>
        <div className="lb-tabs">
          <button className={`lb-tab${sort === 'score' ? ' active' : ''}`} onClick={() => setSort('score')}>Score</button>
          <button className={`lb-tab${sort === 'coins' ? ' active' : ''}`} onClick={() => setSort('coins')}>Coins</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '40vh' }}>
          <div className="spinner" />
          Chargement…
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-condensed)' }}>
          Aucun joueur pour le moment.
        </div>
      ) : (
        <div className="lb-table-wrap">
          <table className="lb-table">
            <thead>
              <tr>
                <th>Rang</th>
                <th>Joueur</th>
                {sort === 'score' ? <th>Score</th> : <th>Coins</th>}
                <th>Pokémon</th>
                <th>Légendaires</th>
                <th>Échanges</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`lb-row ${i < 3 ? `lb-row-top${i + 1}` : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Voir le profil de ${entry.display_name}`}
                  onClick={() => navigate(`/u/${entry.id}`)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/u/${entry.id}`);
                    }
                  }}
                >
                  <td className="lb-rank">
                    {i < 3 ? <span className="medal">{MEDAL[i]}</span> : <span className="rank-num">{i + 1}</span>}
                  </td>
                  <td className="lb-name">{entry.display_name}</td>
                  <td className={sort === 'coins' ? 'lb-coins' : 'lb-score'}>
                    {sort === 'coins' ? `${entry.coins.toLocaleString()} 💰` : entry.total_score.toLocaleString()}
                  </td>
                  <td className="lb-count">{entry.pokemon_count}</td>
                  <td className="lb-legendary">
                    {entry.legendary_count > 0
                      ? <span className="legendary-badge">★ {entry.legendary_count}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="lb-trades">{entry.trade_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
