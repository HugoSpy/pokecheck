import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLeaderboard, type LeaderboardEntry } from '../api';
import './Leaderboard.css';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getLeaderboard()
      .then(setEntries)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      Chargement du classement…
    </div>
  );

  if (error) return <div className="error-banner" style={{ margin: '40px auto', maxWidth: 500 }}>Erreur : {error}</div>;

  return (
    <div className="lb-page">
      <div className="lb-header">
        <h1 className="lb-title">Classement</h1>
        <div className="lb-subtitle">Top 50 collectionneurs</div>
      </div>

      {entries.length === 0 ? (
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
                <th>Score</th>
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
                  onClick={() => navigate(`/u/${entry.id}`)}
                >
                  <td className="lb-rank">
                    {i < 3 ? (
                      <span className="medal">{MEDAL[i]}</span>
                    ) : (
                      <span className="rank-num">{i + 1}</span>
                    )}
                  </td>
                  <td className="lb-name">{entry.display_name}</td>
                  <td className="lb-score">{entry.total_score.toLocaleString()}</td>
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
