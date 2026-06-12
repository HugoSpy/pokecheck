import { useEffect, useState } from 'react';
import { getFeatures, voteFeature, proposeFeature } from '../api/features';
import type { Feature } from '../api/features';
import { useUserCtx } from '../context/UserContext';
import FeatureCard, { applyVoteOptimistic } from '../components/FeatureCard';
import { Lightbulb } from '../components/icons';
import Toast from '../components/Toast';
import './Features.css';

const TITLE_MAX = 100;
const DESC_MAX = 1000;

export default function Features() {
  const { profile } = useUserCtx();
  const isAdmin = profile?.is_admin === true;

  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    try {
      setFeatures(await getFeatures());
    } catch (e) {
      showToast((e as Error).message ?? 'Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleVote(id: string, value: 1 | -1) {
    const prev = features;
    const target = prev.find(f => f.id === id);
    if (!target) return;

    // Optimistic update (don't re-sort while the user is interacting).
    const optimistic = applyVoteOptimistic(target.score, target.myVoteToday, value);
    setFeatures(prev.map(f => (f.id === id ? { ...f, ...optimistic } : f)));
    setVotingId(id);

    try {
      const res = await voteFeature(id, value);
      setFeatures(cur => cur.map(f => (f.id === id ? { ...f, score: res.score, myVoteToday: res.myVoteToday } : f)));
    } catch (e) {
      setFeatures(prev); // revert
      showToast((e as Error).message ?? 'Erreur lors du vote', 'error');
    } finally {
      setVotingId(null);
    }
  }

  async function handleProposed(created: { status: string }) {
    setModalOpen(false);
    if (created.status === 'PUBLISHED') {
      showToast('Suggestion publiée !', 'success');
      load();
    } else {
      showToast('Merci ! Ta suggestion est en attente de validation par un admin.', 'success');
    }
  }

  return (
    <div className="feat-page">
      <header className="feat-header">
        <div>
          <p className="feat-eyebrow">// boîte à idées</p>
          <h1 className="feat-title">
            <Lightbulb size={24} className="feat-title-icon" />
            Suggestions
          </h1>
          <p className="feat-subtitle">Proposez et votez pour les prochaines fonctionnalités.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          Proposer une idée
        </button>
      </header>

      {loading ? (
        <p className="feat-empty">Chargement…</p>
      ) : features.length === 0 ? (
        <p className="feat-empty">Aucune suggestion pour le moment. Soyez le premier à en proposer une !</p>
      ) : (
        <div className="feat-list">
          {features.map(f => (
            <FeatureCard key={f.id} feature={f} onVote={handleVote} voting={votingId === f.id} />
          ))}
        </div>
      )}

      {modalOpen && (
        <ProposeModal
          isAdmin={isAdmin}
          onClose={() => setModalOpen(false)}
          onProposed={handleProposed}
          onError={msg => showToast(msg, 'error')}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Propose modal ─────────────────────────────────────────────────────────────

interface ModalProps {
  isAdmin: boolean;
  onClose: () => void;
  onProposed: (created: { status: string }) => void;
  onError: (msg: string) => void;
}

function ProposeModal({ isAdmin, onClose, onProposed, onError }: ModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && description.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const created = await proposeFeature(title.trim(), description.trim());
      onProposed(created);
    } catch (e) {
      onError((e as Error).message ?? 'Erreur lors de l\'envoi');
      setSubmitting(false);
    }
  }

  return (
    <div className="feat-modal-overlay" onClick={onClose}>
      <div className="feat-modal" onClick={e => e.stopPropagation()}>
        <h2 className="feat-modal-title">Proposer une idée</h2>
        <p className="feat-modal-hint">
          {isAdmin
            ? 'En tant qu\'admin, ta suggestion sera publiée immédiatement.'
            : 'Ta suggestion sera relue par un admin avant d\'apparaître publiquement.'}
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
            placeholder="Ex : Ajouter un mode sombre"
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
            rows={5}
            onChange={e => setDescription(e.target.value)}
            placeholder="Décris ton idée en quelques phrases…"
          />
        </div>

        <div className="feat-modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}
