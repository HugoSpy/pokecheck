import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUnnotifiedBadges, markBadgesNotified, claimBadge } from '../api/userApi';
import { useUserCtx } from '../context/UserContext';
import type { UserBadge } from '../api/types';
import { Coins } from './icons';
import './BadgeNotification.css';

const DISPLAY_MS = 4000;
const FADE_MS    = 400;

export default function BadgeNotification() {
  const navigate = useNavigate();
  const { setCoins } = useUserCtx();

  const [queue, setQueue]     = useState<UserBadge[]>([]);
  const [current, setCurrent] = useState<UserBadge | null>(null);
  const [visible, setVisible] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const processingRef = useRef(false);
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function checkBadges() {
    try {
      const badges = await getUnnotifiedBadges();
      if (badges.length > 0) {
        setQueue(prev => [...prev, ...badges]);
        await markBadgesNotified(badges.map(b => b.badge_id));
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    checkBadges();
    const interval = setInterval(checkBadges, 30_000);
    return () => clearInterval(interval);
  }, []);

  const dismiss = useCallback(() => {
    if (hideTimerRef.current)  clearTimeout(hideTimerRef.current);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    setVisible(false);
    clearTimerRef.current = setTimeout(() => {
      setCurrent(null);
      setClaiming(false);
      processingRef.current = false;
    }, FADE_MS);
  }, []);

  // Consume queue one badge at a time
  useEffect(() => {
    if (queue.length === 0 || current !== null || processingRef.current) return;

    processingRef.current = true;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
    setClaiming(false);
    setVisible(true);

    // Auto-dismiss after DISPLAY_MS
    hideTimerRef.current = setTimeout(() => setVisible(false), DISPLAY_MS - FADE_MS);
    clearTimerRef.current = setTimeout(() => {
      setCurrent(null);
      processingRef.current = false;
    }, DISPLAY_MS);

    return () => {
      if (hideTimerRef.current)  clearTimeout(hideTimerRef.current);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [queue, current]);

  async function handleClaim() {
    if (!current || claiming) return;
    setClaiming(true);
    try {
      const result = await claimBadge(current.badge_id);
      setCoins(result.total_coins);
    } catch {
      // 409 = already claimed elsewhere — just dismiss silently
    }
    dismiss();
  }

  function handleOpenProfile() {
    dismiss();
    navigate('/profile');
  }

  if (!current) return null;

  return (
    <div className="badge-notif">
      <div className={`badge-notif-card${visible ? ' visible' : ''}`} key={current.id}>
        <button className="badge-notif-close" onClick={dismiss} aria-label="Fermer">✕</button>

        <div className="badge-notif-header">🏆 Nouveau badge !</div>

        <div className="badge-notif-icon">
          {current.badge.icon_url ? (
            <img src={current.badge.icon_url} alt={current.badge.name} width={40} height={40} />
          ) : (
            <span style={{ fontSize: 36 }}>🏅</span>
          )}
        </div>

        <div className="badge-notif-name">{current.badge.name}</div>
        <div className="badge-notif-desc">{current.badge.description}</div>

        <div className="badge-notif-actions">
          <button
            className="badge-notif-claim-btn"
            onClick={handleClaim}
            disabled={claiming}
          >
            {claiming ? (
              <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} />
            ) : (
              <><Coins size={13} /> Récupérer {current.badge.coin_reward} coins</>
            )}
          </button>
          <button className="badge-notif-profile-btn" onClick={handleOpenProfile}>
            Voir profil
          </button>
        </div>

        {/* Progress bar depletes over DISPLAY_MS to signal auto-close */}
        <div className="badge-notif-progress" style={{ animationDuration: `${DISPLAY_MS}ms` }} />
      </div>
    </div>
  );
}
