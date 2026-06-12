import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserCtx } from '../../context/UserContext';
import {
  getFeatures, voteFeature,
  getPendingFeatures, publishFeature, editFeature, rejectFeature, markFeatureDone, getFeaturesHistory,
} from '../../api/features';
import type { Feature, PendingFeature, HistoryFeature } from '../../api/features';
import FeatureCard, { applyVoteOptimistic } from '../../components/FeatureCard';
import { Shield } from '../../components/icons';
import Toast from '../../components/Toast';
import '../Features.css';

const TITLE_MAX = 100;
const DESC_MAX = 1000;

type Tab = 'pending' | 'published' | 'history';

export default function AdminFeatures() {
  const { profile } = useUserCtx();
  const navigate = useNavigate();

  if (!profile?.is_admin) {
    navigate('/leaderboard', { replace: true });
    return null;
  }

  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<PendingFeature[]>([]);
  const [published, setPublished] = useState<Feature[]>([]);
  const [history, setHistory] = useState<HistoryFeature[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  function showToast(msg: string, type: 'success' | 'error') { setToast({ msg, type }); }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadPending() {
    try { setPending(await getPendingFeatures()); }
    catch (e) { showToast((e as Error).message, 'error'); }
  }
  async function loadPublished() {
    try { setPublished(await getFeatures()); }
    catch (e) { showToast((e as Error).message, 'error'); }
  }
  async function loadHistory() {
    try { setHistory(await getFeaturesHistory()); }
    catch (e) { showToast((e as Error).message, 'error'); }
  }

  useEffect(() => { loadPending(); }, []);
  useEffect(() => {
    if (tab === 'published') loadPublished();
    if (tab === 'history') loadHistory();
  }, [tab]);

  // ── Pending actions ─────────────────────────────────────────────────────────

  async function handlePublish(id: string, title: string, description: string) {
    try {
      await publishFeature(id, { title, description });
      setPending(p => p.filter(f => f.id !== id));
      showToast('Suggestion publiée.', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Erreur', 'error');
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectFeature(id);
      setPending(p => p.filter(f => f.id !== id));
      showToast('Suggestion refusée.', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Erreur', 'error');
    }
  }

  // ── Published actions ───────────────────────────────────────────────────────

  async function handleVote(id: string, value: 1 | -1) {
    const prev = published;
    const target = prev.find(f => f.id === id);
    if (!target) return;
    const optimistic = applyVoteOptimistic(target.score, target.myVoteToday, value);
    setPublished(prev.map(f => (f.id === id ? { ...f, ...optimistic } : f)));
    try {
      const res = await voteFeature(id, value);
      setPublished(cur => cur.map(f => (f.id === id ? { ...f, score: res.score, myVoteToday: res.myVoteToday } : f)));
    } catch (e) {
      setPublished(prev);
      showToast((e as Error).message ?? 'Erreur lors du vote', 'error');
    }
  }

  async function handleDone(id: string) {
    try {
      await markFeatureDone(id);
      setPublished(p => p.filter(f => f.id !== id));
      showToast('Marquée comme faite.', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Erreur', 'error');
    }
  }

  async function handleEdit(id: string, title: string, description: string) {
    const updated = await editFeature(id, { title, description });
    setPublished(p => p.map(f => (f.id === id ? { ...f, title: updated.title, description: updated.description } : f)));
    showToast('Idée modifiée.', 'success');
  }

  return (
    <div className="feat-page">
      <header className="feat-header">
        <div>
          <p className="feat-eyebrow">// accès restreint</p>
          <h1 className="feat-title">
            <Shield size={22} className="feat-title-icon" />
            Suggestions — Admin
          </h1>
        </div>
      </header>

      <div className="feat-tabs">
        <button className={`feat-tab${tab === 'pending' ? ' active' : ''}`} onClick={() => setTab('pending')}>
          En attente{pending.length > 0 && <span className="feat-tab-count">{pending.length}</span>}
        </button>
        <button className={`feat-tab${tab === 'published' ? ' active' : ''}`} onClick={() => setTab('published')}>
          Publiées
        </button>
        <button className={`feat-tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          Historique
        </button>
      </div>

      {tab === 'pending' && (
        pending.length === 0
          ? <p className="feat-empty">Aucune suggestion en attente.</p>
          : <div>{pending.map(f => (
              <PendingCard key={f.id} feature={f} onPublish={handlePublish} onReject={handleReject} />
            ))}</div>
      )}

      {tab === 'published' && (
        published.length === 0
          ? <p className="feat-empty">Aucune suggestion publiée.</p>
          : <div className="feat-list">{published.map(f => (
              <PublishedAdminCard
                key={f.id}
                feature={f}
                onVote={handleVote}
                onDone={() => handleDone(f.id)}
                onEdit={handleEdit}
                onError={msg => showToast(msg, 'error')}
              />
            ))}</div>
      )}

      {tab === 'history' && (
        history.length === 0
          ? <p className="feat-empty">Aucune suggestion terminée.</p>
          : <div className="feat-list">{history.map(f => (
              <div key={f.id} className="feat-admin-card">
                <h3 className="feat-card-title">{f.title}</h3>
                <p className="feat-card-desc">{f.description}</p>
                <p className="feat-admin-meta">
                  Score final : <strong>{f.score}</strong>
                  {f.done_at && <> · Terminée le {new Date(f.done_at).toLocaleDateString('fr-FR')}</>}
                  {' '}· par {f.creator_name}
                </p>
              </div>
            ))}</div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Pending card (inline edit + publish/reject) ───────────────────────────────

interface PendingCardProps {
  feature: PendingFeature;
  onPublish: (id: string, title: string, description: string) => void;
  onReject: (id: string) => void;
}

function PendingCard({ feature, onPublish, onReject }: PendingCardProps) {
  const [title, setTitle] = useState(feature.title);
  const [description, setDescription] = useState(feature.description);
  const [confirmReject, setConfirmReject] = useState(false);

  const canPublish = title.trim().length > 0 && description.trim().length > 0;

  return (
    <div className="feat-admin-card">
      <p className="feat-admin-meta">
        Proposé par {feature.creator_name} · {new Date(feature.created_at).toLocaleDateString('fr-FR')}
      </p>

      <div className="feat-field">
        <div className="feat-label">
          <span>Titre</span>
          <span className="feat-counter">{title.length}/{TITLE_MAX}</span>
        </div>
        <input
          className="feat-input"
          value={title}
          maxLength={TITLE_MAX}
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      <div className="feat-field">
        <div className="feat-label">
          <span>Description</span>
          <span className="feat-counter">{description.length}/{DESC_MAX}</span>
        </div>
        <textarea
          className="feat-textarea"
          value={description}
          maxLength={DESC_MAX}
          rows={4}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      {confirmReject ? (
        <div className="feat-confirm">
          <span>Refuser et supprimer définitivement cette suggestion ?</span>
          <button className="btn btn-danger" onClick={() => onReject(feature.id)}>Oui, refuser</button>
          <button className="btn btn-ghost" onClick={() => setConfirmReject(false)}>Annuler</button>
        </div>
      ) : (
        <div className="feat-admin-actions">
          <button
            className="btn btn-primary"
            onClick={() => onPublish(feature.id, title.trim(), description.trim())}
            disabled={!canPublish}
          >
            Publier
          </button>
          <button className="btn btn-danger" onClick={() => setConfirmReject(true)}>Refuser</button>
        </div>
      )}
    </div>
  );
}

// ── Published card: vote view + inline edit + done ────────────────────────────

interface PublishedAdminCardProps {
  feature: Feature;
  onVote: (id: string, value: 1 | -1) => void;
  onDone: () => void;
  onEdit: (id: string, title: string, description: string) => Promise<void>;
  onError: (msg: string) => void;
}

function PublishedAdminCard({ feature, onVote, onDone, onEdit, onError }: PublishedAdminCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const [title, setTitle] = useState(feature.title);
  const [description, setDescription] = useState(feature.description);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && description.trim().length > 0 && !saving;

  function startEdit() {
    setTitle(feature.title);
    setDescription(feature.description);
    setEditing(true);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onEdit(feature.id, title.trim(), description.trim());
      setEditing(false);
    } catch (e) {
      onError((e as Error).message ?? 'Erreur lors de la modification');
    } finally {
      setSaving(false);
    }
  }

  // Edit mode: keep the vote column visible (read-only), swap the body for a form.
  if (editing) {
    return (
      <div className="feat-card">
        <div className="feat-vote">
          <span className="feat-score">{feature.score}</span>
        </div>
        <div className="feat-card-body">
          <div className="feat-field">
            <div className="feat-label">
              <span>Titre</span>
              <span className="feat-counter">{title.length}/{TITLE_MAX}</span>
            </div>
            <input
              className="feat-input"
              value={title}
              maxLength={TITLE_MAX}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div className="feat-field">
            <div className="feat-label">
              <span>Description</span>
              <span className="feat-counter">{description.length}/{DESC_MAX}</span>
            </div>
            <textarea
              className="feat-textarea"
              value={description}
              maxLength={DESC_MAX}
              rows={4}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="feat-admin-actions">
            <button className="btn btn-primary" onClick={save} disabled={!canSave}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={saving}>Annuler</button>
          </div>
        </div>
      </div>
    );
  }

  const extraAction = confirmDone ? (
    <div className="feat-confirm" style={{ marginTop: 12 }}>
      <span>Marquer comme réalisée ?</span>
      <button className="btn btn-primary" onClick={onDone}>Oui</button>
      <button className="btn btn-ghost" onClick={() => setConfirmDone(false)}>Annuler</button>
    </div>
  ) : (
    <div className="feat-admin-actions">
      <button className="btn btn-ghost" onClick={startEdit}>Éditer</button>
      <button className="btn btn-ghost" onClick={() => setConfirmDone(true)}>Marquer comme fait</button>
    </div>
  );

  return <FeatureCard feature={feature} onVote={onVote} extraAction={extraAction} />;
}
