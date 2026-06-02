import { useEffect, useState, useRef } from 'react';
import { getUnnotifiedBadges, markBadgesNotified } from '../api/userApi';
import type { UserBadge } from '../api/types';
import './BadgeNotification.css';

export default function BadgeNotification() {
  const [queue, setQueue] = useState<UserBadge[]>([]);
  const [current, setCurrent] = useState<UserBadge | null>(null);
  const [visible, setVisible] = useState(false);
  const processingRef = useRef(false);

  async function checkBadges() {
    try {
      const badges = await getUnnotifiedBadges();
      if (badges.length > 0) {
        setQueue(prev => [...prev, ...badges]);
        await markBadgesNotified(badges.map(b => b.badge_id));
      }
    } catch { /* silent */ }
  }

  // Poll on mount and every 30s
  useEffect(() => {
    checkBadges();
    const interval = setInterval(checkBadges, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Consume queue one badge at a time
  useEffect(() => {
    if (queue.length === 0 || current !== null || processingRef.current) return;

    processingRef.current = true;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
    setVisible(true);

    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 3500);

    const clearTimer = setTimeout(() => {
      setCurrent(null);
      processingRef.current = false;
    }, 4000);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [queue, current]);

  if (!current) return null;

  return (
    <div className="badge-notif">
      <div className={`badge-notif-card${visible ? ' visible' : ''}`}>
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
        <div className="badge-notif-coins">💰 {current.badge.coin_reward} coins à récupérer</div>
      </div>
    </div>
  );
}
