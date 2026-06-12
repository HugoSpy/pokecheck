import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserCtx } from '../context/UserContext';
import { generateAdminPack } from '../api/adminApi';
import { startAttendanceCheck } from '../api/attendanceApi';
import { getAdminUsers, sendMessageAll, sendMessageUser } from '../api/adminPortalApi';
import type { AdminUser } from '../api/adminPortalApi';
import { Shield } from '../components/icons';
import { getPendingFeatures } from '../api/features';
import './AdminPortal.css';

export default function AdminPortal() {
  const { profile } = useUserCtx();
  const navigate = useNavigate();

  if (!profile?.is_admin) {
    navigate('/leaderboard', { replace: true });
    return null;
  }

  return (
    <div className="ap-page">
      <header className="ap-header">
        <p className="ap-eyebrow">// accès restreint</p>
        <h1 className="ap-title">
          <Shield size={22} style={{ verticalAlign: 'middle', marginRight: 10, color: 'var(--warning)' }} />
          Admin Portal
        </h1>
      </header>

      <div className="ap-layout">
        <section className="ap-section">
          <h2 className="ap-section-label">Actions rapides</h2>
          <div className="ap-actions-grid">
            <AttendanceCard />
            <PackCard />
            <FeaturesCard />
          </div>
        </section>

        <section className="ap-section">
          <h2 className="ap-section-label">Messagerie</h2>
          <div className="ap-msg-grid">
            <MessageAllCard />
            <MessageUserCard />
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Attendance card ──────────────────────────────────────────────────────────

function AttendanceCard() {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyActive, setAlreadyActive] = useState(false);

  async function handleStart(force = false) {
    setLoading(true);
    setError(null);
    try {
      await startAttendanceCheck(force);
      setSuccess(true);
      setConfirm(false);
      setAlreadyActive(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        setAlreadyActive(true);
      } else {
        setError(err.message);
      }
      setConfirm(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ap-card">
      <div className="ap-card-icon">📋</div>
      <div>
        <h3 className="ap-card-title">Check présence</h3>
        <p className="ap-card-desc">Ouvre une fenêtre de 15 min. Chaque élève peut tirer 1 Pokémon.</p>
      </div>

      {error && <p className="ap-feedback ap-feedback--error">{error}</p>}

      {alreadyActive ? (
        <div className="ap-confirm-row">
          <span className="ap-confirm-label">Un check est déjà actif. Forcer quand même ?</span>
          <button className="ap-btn ap-btn--danger" onClick={() => handleStart(true)} disabled={loading}>
            Forcer
          </button>
          <button className="ap-btn" onClick={() => setAlreadyActive(false)}>Non</button>
        </div>
      ) : confirm ? (
        <div className="ap-confirm-row">
          <span className="ap-confirm-label">Confirmer le lancement ?</span>
          <button
            className={`ap-btn ap-btn--primary${success ? ' ap-btn--success' : ''}`}
            onClick={() => handleStart(false)}
            disabled={loading}
          >
            {loading ? 'Lancement…' : 'Oui, lancer'}
          </button>
          <button className="ap-btn" onClick={() => setConfirm(false)}>Annuler</button>
        </div>
      ) : (
        <button
          className={`ap-btn ap-btn--primary${success ? ' ap-btn--success' : ''}`}
          onClick={() => setConfirm(true)}
        >
          {success ? 'Lancé ✓' : 'Lancer un check'}
        </button>
      )}

      <a href="/admin/attendance" className="ap-detail-link">
        Voir l'historique complet →
      </a>
    </div>
  );
}

// ── Pack card ────────────────────────────────────────────────────────────────

function PackCard() {
  const navigate = useNavigate();
  const [forceShiny, setForceShiny] = useState(false);
  const [forceDitto, setForceDitto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const { code } = await generateAdminPack(forceShiny, forceDitto);
      setForceShiny(false);
      setForceDitto(false);
      navigate(`/open?code=${code}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ap-card">
      <div className="ap-card-icon">📦</div>
      <div>
        <h3 className="ap-card-title">Ouvrir un pack</h3>
        <p className="ap-card-desc">Génère un one-shot code et redirige vers l'animation d'ouverture.</p>
      </div>

      {error && <p className="ap-feedback ap-feedback--error">{error}</p>}

      <div className="ap-checkbox-row">
        <label className="ap-checkbox-label">
          <input
            type="checkbox"
            checked={forceShiny}
            onChange={e => setForceShiny(e.target.checked)}
          />
          Force Shiny ✨
        </label>
        <label className="ap-checkbox-label">
          <input
            type="checkbox"
            checked={forceDitto}
            onChange={e => setForceDitto(e.target.checked)}
          />
          Force Ditto 🔮
        </label>
      </div>

      <button className="ap-btn ap-btn--primary" onClick={handleGenerate} disabled={loading}>
        {loading ? 'Génération…' : 'Générer un pack'}
      </button>
    </div>
  );
}

// ── Features card ────────────────────────────────────────────────────────────

function FeaturesCard() {
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    getPendingFeatures().then(list => setPendingCount(list.length)).catch(() => {});
  }, []);

  return (
    <div className="ap-card">
      <div className="ap-card-icon">💡</div>
      <div>
        <h3 className="ap-card-title">Suggestions</h3>
        <p className="ap-card-desc">
          Modère les idées proposées par les élèves : valide, refuse ou marque comme faites.
        </p>
      </div>

      {pendingCount !== null && pendingCount > 0 && (
        <p className="ap-feedback ap-feedback--warning">
          {pendingCount} suggestion{pendingCount > 1 ? 's' : ''} en attente
        </p>
      )}

      <a href="/admin/features" className="ap-detail-link">
        Gérer les suggestions →
      </a>
    </div>
  );
}

// ── Message all card ─────────────────────────────────────────────────────────

function MessageAllCard() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { sent } = await sendMessageAll(content.trim());
      setContent('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      void sent;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ap-msg-card">
      <h3 className="ap-msg-card-title">Message à tous</h3>
      <p className="ap-card-desc">Envoie une notification à l'ensemble des utilisateurs.</p>

      {error && <p className="ap-feedback ap-feedback--error">{error}</p>}

      <textarea
        className="ap-textarea"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Contenu du message…"
        rows={4}
      />

      <button
        className={`ap-btn ap-btn--primary${success ? ' ap-btn--success' : ''}`}
        onClick={handleSend}
        disabled={loading || !content.trim()}
      >
        {loading ? 'Envoi…' : success ? 'Envoyé ✓' : 'Envoyer à tous'}
      </button>
    </div>
  );
}

// ── Message user card ────────────────────────────────────────────────────────

function MessageUserCard() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAdminUsers().then(({ users: list }) => setUsers(list)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!dropOpen) return;
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [dropOpen]);

  const filtered = users.filter(u =>
    u.display_name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 40);

  function selectUser(u: AdminUser) {
    setSelected(u);
    setSearch('');
    setDropOpen(false);
  }

  async function handleSend() {
    if (!selected || !content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await sendMessageUser(selected.id, content.trim());
      setContent('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ap-msg-card">
      <h3 className="ap-msg-card-title">Message à un user</h3>
      <p className="ap-card-desc">Cible un élève spécifique via le dropdown.</p>

      {error && <p className="ap-feedback ap-feedback--error">{error}</p>}

      <div className="ap-user-search" ref={dropRef}>
        <input
          className="ap-search-input"
          value={selected ? selected.display_name : search}
          onChange={e => {
            setSearch(e.target.value);
            setSelected(null);
            setDropOpen(true);
          }}
          onFocus={() => setDropOpen(true)}
          placeholder="Rechercher un utilisateur…"
        />
        {selected && (
          <button
            className="ap-clear-user"
            onClick={() => { setSelected(null); setSearch(''); }}
            title="Effacer"
          >
            ×
          </button>
        )}
        {dropOpen && filtered.length > 0 && (
          <div className="ap-dropdown">
            {filtered.map(u => (
              <div
                key={u.id}
                className="ap-dropdown-item"
                onMouseDown={() => selectUser(u)}
              >
                {u.display_name}
              </div>
            ))}
          </div>
        )}
      </div>

      <textarea
        className="ap-textarea"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Contenu du message…"
        rows={4}
      />

      <button
        className={`ap-btn ap-btn--primary${success ? ' ap-btn--success' : ''}`}
        onClick={handleSend}
        disabled={loading || !content.trim() || !selected}
      >
        {loading ? 'Envoi…' : success ? 'Envoyé ✓' : 'Envoyer'}
      </button>
    </div>
  );
}
