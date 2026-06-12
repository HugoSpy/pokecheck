import type { ReactNode } from 'react';
import { ThumbsUp, ThumbsDown } from './icons';
import type { Feature } from '../api/features';

/**
 * Mirrors the backend vote logic to predict the next (score, myVoteToday) for an
 * optimistic UI update:
 *  - same value as today's vote  → toggle off (un-vote)
 *  - opposite value              → switch (score swings by 2)
 *  - no vote today               → new vote
 */
export function applyVoteOptimistic(
  score: number,
  myVoteToday: 1 | -1 | null,
  value: 1 | -1,
): { score: number; myVoteToday: 1 | -1 | null } {
  if (myVoteToday === value) return { score: score - value, myVoteToday: null };
  if (myVoteToday === null) return { score: score + value, myVoteToday: value };
  // opposite vote → swing by 2 (remove old, add new)
  return { score: score + 2 * value, myVoteToday: value };
}

interface Props {
  feature: Feature;
  onVote: (id: string, value: 1 | -1) => void;
  voting?: boolean;
  extraAction?: ReactNode;
}

export default function FeatureCard({ feature, onVote, voting, extraAction }: Props) {
  return (
    <div className="feat-card">
      <div className="feat-vote">
        <button
          className={`feat-vote-btn feat-vote-btn--up${feature.myVoteToday === 1 ? ' active' : ''}`}
          onClick={() => onVote(feature.id, 1)}
          disabled={voting}
          aria-label="Voter pour"
          aria-pressed={feature.myVoteToday === 1}
        >
          <ThumbsUp size={16} />
        </button>
        <span className="feat-score">{feature.score}</span>
        <button
          className={`feat-vote-btn feat-vote-btn--down${feature.myVoteToday === -1 ? ' active' : ''}`}
          onClick={() => onVote(feature.id, -1)}
          disabled={voting}
          aria-label="Voter contre"
          aria-pressed={feature.myVoteToday === -1}
        >
          <ThumbsDown size={16} />
        </button>
      </div>

      <div className="feat-card-body">
        <h3 className="feat-card-title">{feature.title}</h3>
        <p className="feat-card-desc">{feature.description}</p>
        <p className="feat-card-meta">Proposé par {feature.creator}</p>
        {extraAction}
      </div>
    </div>
  );
}
