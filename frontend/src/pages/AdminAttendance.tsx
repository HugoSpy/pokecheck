import { useEffect, useState, useCallback } from 'react';
import {
  startAttendanceCheck,
  getActiveAttendanceChecks,
  cancelAttendanceCheck,
  type AttendanceCheckSummary,
} from '../api/attendanceApi';
import Toast from '../components/Toast';
import { Pokeball } from '../components/icons';
import './AdminAttendance.css';

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type CheckStatus = 'active' | 'expired' | 'cancelled';

const RECENT_CHECK_MS = 60 * 60 * 1000;

function statusOf(c: AttendanceCheckSummary, now: number): CheckStatus {
  if (c.cancelled_at) return 'cancelled';
  if (new Date(c.expires_at).getTime() > now) return 'active';
  return 'expired';
}

function AttendanceCheckCard({
  check,
  now,
  onCancel,
}: {
  check: AttendanceCheckSummary;
  now: number;
  onCancel: (id: string) => void;
}) {
  const status = statusOf(check, now);
  const remaining = new Date(check.expires_at).getTime() - now;
  const pct = check.total_users > 0
    ? Math.min(100, Math.round((check.openings_count / check.total_users) * 100))
    : 0;

  return (
    <div className={`att-card att-card--${status}`}>
      <div className="att-card-top">
        <span className="att-card-time">Lancé à {fmtTime(check.created_at)}</span>
        {status === 'active' && (
          <span className="att-card-countdown">⏱ {fmtCountdown(remaining)}</span>
        )}
        {status === 'expired' && <span className="att-card-status att-card-status--expired">Expiré</span>}
        {status === 'cancelled' && <span className="att-card-status att-card-status--cancelled">Annulé</span>}
      </div>

      <div className="att-card-progress">
        <div className="att-card-progress-head">
          <span><strong>{check.openings_count}</strong> / {check.total_users} élèves ont ouvert</span>
          <span className="att-card-pct">{pct} %</span>
        </div>
        <div className="att-progress-bar">
          <div className="att-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="att-card-actions">
        {status === 'cancelled' ? (
          <span className="att-cancelled-badge">ANNULÉ</span>
        ) : (
          <button
            className="btn btn-danger"
            onClick={() => onCancel(check.id)}
          >
            Annuler & rollback
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminAttendance() {
  const [checks, setChecks] = useState<AttendanceCheckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [confirmStart, setConfirmStart] = useState(false);
  const [activeExists, setActiveExists] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { checks } = await getActiveAttendanceChecks();
      setChecks(checks);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Poll list every 5s
  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const i = setInterval(refresh, 5000);
    return () => clearInterval(i);
  }, [refresh]);

  // Countdown tick
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  async function doStart(force: boolean) {
    setStarting(true);
    try {
      await startAttendanceCheck(force);
      setConfirmStart(false);
      setActiveExists(false);
      showToast('Check présence lancé ! Les élèves ont 15 minutes.', 'success');
      refresh();
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        setActiveExists(true);
      } else {
        showToast(err.message, 'error');
        setConfirmStart(false);
      }
    } finally {
      setStarting(false);
    }
  }

  async function doCancel(id: string) {
    setCancelling(true);
    try {
      const r = await cancelAttendanceCheck(id);
      setCancelTarget(null);
      showToast(
        `Annulé : ${r.rolled_back_count} Pokémon retiré(s), ${r.coins_removed} coins repris.`,
        'success'
      );
      refresh();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setCancelling(false);
    }
  }

  const recentChecks = checks.filter(c => now - new Date(c.created_at).getTime() < RECENT_CHECK_MS);
  const oldChecks = checks.filter(c => now - new Date(c.created_at).getTime() >= RECENT_CHECK_MS);

  return (
    <div className="att-page">
      <div className="att-header">
        <div>
          <h1 className="att-title">Check présence</h1>
          <p className="att-subtitle">Donne 1 ouverture de pack à tous les élèves pendant 15 minutes.</p>
        </div>
        <button
          className="att-launch-btn"
          onClick={() => { setActiveExists(false); setConfirmStart(true); }}
        >
          <Pokeball size={20} /> Lancer un check présence
        </button>
      </div>

      {error && <div className="error-banner">Erreur : {error}</div>}

      {loading ? (
        <div className="loading-screen"><div className="spinner" /> Chargement…</div>
      ) : checks.length === 0 ? (
        <div className="att-empty">Aucun check présence ces dernières 24 h.</div>
      ) : (
        <div className="att-sections">
          <section className="att-section">
            <h2 className="att-section-title">Actifs</h2>
            {recentChecks.length === 0 ? (
              <div className="att-empty att-empty--compact">Aucun check de moins d'1 heure.</div>
            ) : (
              <div className="att-list">
                {recentChecks.map(check => (
                  <AttendanceCheckCard
                    key={check.id}
                    check={check}
                    now={now}
                    onCancel={setCancelTarget}
                  />
                ))}
              </div>
            )}
          </section>

          {oldChecks.length > 0 && (
            <details className="att-section att-old-section">
              <summary className="att-section-title att-old-summary">
                Anciens checks ({oldChecks.length})
              </summary>
              <div className="att-list att-old-list">
                {oldChecks.map(check => (
                  <AttendanceCheckCard
                    key={check.id}
                    check={check}
                    now={now}
                    onCancel={setCancelTarget}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Start confirm modal */}
      {confirmStart && (
        <div className="admin-modal-overlay" onClick={() => !starting && setConfirmStart(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-title">Lancer un check présence</div>
            {activeExists ? (
              <p className="att-modal-text att-modal-warn">
                ⚠ Un check présence est déjà actif. En lancer un second quand même ?
              </p>
            ) : (
              <p className="att-modal-text">
                Cela va donner droit à <strong>1 ouverture</strong> à tous les élèves pendant
                <strong> 15 minutes</strong>. Confirmer ?
              </p>
            )}
            <div className="admin-modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmStart(false)} disabled={starting}>
                Annuler
              </button>
              <button
                className="btn btn-primary"
                onClick={() => doStart(activeExists)}
                disabled={starting}
              >
                {starting
                  ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  : activeExists ? 'Lancer quand même' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm modal */}
      {cancelTarget && (
        <div className="admin-modal-overlay" onClick={() => !cancelling && setCancelTarget(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-title">Annuler le check présence</div>
            <p className="att-modal-text att-modal-warn">
              Cela va <strong>supprimer les Pokémons</strong> obtenus pendant ce check et reprendre
              les coins des ventes. Action irréversible. Confirmer ?
            </p>
            <div className="admin-modal-actions">
              <button className="btn btn-ghost" onClick={() => setCancelTarget(null)} disabled={cancelling}>
                Retour
              </button>
              <button className="btn btn-danger" onClick={() => doCancel(cancelTarget)} disabled={cancelling}>
                {cancelling
                  ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  : 'Annuler & rollback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
