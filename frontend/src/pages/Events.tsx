import { useEffect, useState, type ComponentProps } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveEvents } from '../api/eventApi';
import BoosterPack3D from '../components/BoosterPack3D';
import { useUserCtx } from '../context/UserContext';
import type { GameEvent } from '../api/types';
import './Events.css';

// ── Countdown hook ──────────────────────────────────────────────────────────

function useCountdown(endDate: string): string {
  const [remaining, setRemaining] = useState(() => computeRemaining(endDate));

  useEffect(() => {
    const id = setInterval(() => setRemaining(computeRemaining(endDate)), 1000);
    return () => clearInterval(id);
  }, [endDate]);

  return remaining;
}

function computeRemaining(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return 'Terminé';

  const totalSecs = Math.floor(diff / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${mins}min`);
  return parts.join(' ');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const RARITY_LABELS: Record<string, string> = {
  COMMON: 'Commun',
  RARE: 'Rare',
  EPIC: 'Épique',
  LEGENDARY: 'Légendaire',
  SHINY: 'Shiny',
};

const RARITY_PILL_CLASS: Record<string, string> = {
  COMMON: 'pill-common',
  RARE: 'pill-rare',
  EPIC: 'pill-epic',
  LEGENDARY: 'pill-legendary',
  SHINY: 'pill-shiny',
};

const EVENT_PACK_CONFIG: Record<string, ComponentProps<typeof BoosterPack3D>> = {
  'Shiny Surge': {
    textureUrl: '/shiny_surge_pack.png',
    textureFlipY: false,
    textureMaterialName: null,
    textureMeshName: 'Object_6',
    transparentMeshName: 'Object_4',
  },
};

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Sub-component ────────────────────────────────────────────────────────────

function EventCard({ event }: { event: GameEvent }) {
  const navigate = useNavigate();
  const { coins } = useUserCtx();
  const countdown = useCountdown(event.ends_at);
  const expired = countdown === 'Terminé';

  const canAfford = coins >= event.price;

  const activePills = Object.entries(event.rarity_multiplier).filter(
    ([, mult]) => mult > 1.0,
  );

  function handleBuy() {
    navigate(`/events/pack?event_id=${event.id}`);
  }

  return (
    <div className="event-card">
      <div className="event-content">
        <div className="event-name">{event.name}</div>

        <div className="event-meta">
          <span className={`event-countdown${expired ? ' expired' : ''}`}>
            {countdown}
          </span>
          <span className="event-dates">
            Du {formatDateShort(event.starts_at)} au {formatDateShort(event.ends_at)}
          </span>
        </div>

        {activePills.length > 0 && (
          <div className="event-multipliers">
            {activePills.map(([rarity, mult]) => (
              <span
                key={rarity}
                className={`multiplier-pill ${RARITY_PILL_CLASS[rarity] ?? 'pill-common'}`}
              >
                {RARITY_LABELS[rarity] ?? rarity} ×{mult}
              </span>
            ))}
          </div>
        )}

        <div className="event-actions">
          <button
            className={`btn ${canAfford ? 'btn-primary' : 'btn-ghost'}`}
            disabled={!canAfford || expired}
            title={!canAfford ? 'Coins insuffisants' : undefined}
            onClick={handleBuy}
          >
            Ouvrir un pack — {event.price} coins
          </button>
        </div>
      </div>

      <div className="event-pack-preview">
        <BoosterPack3D {...EVENT_PACK_CONFIG[event.name]} />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Events() {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getActiveEvents()
      .then(setEvents)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        Chargement des événements…
      </div>
    );
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  return (
    <div className="events-page">
      <h1 className="events-title">Événements</h1>

      {events.length === 0 ? (
        <div className="events-empty">
          <div className="events-empty-title">Aucun événement en cours.</div>
          <div className="events-empty-sub">Reviens bientôt !</div>
        </div>
      ) : (
        events.map(event => <EventCard key={event.id} event={event} />)
      )}
    </div>
  );
}
