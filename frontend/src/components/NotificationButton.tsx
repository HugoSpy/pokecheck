import { useEffect, useRef, useState } from 'react';
import { useUserCtx } from '../context/UserContext';
import { useTradeAnim } from '../context/TradeAnimContext';
import { getNotifications, getUnreadCount, markRead, markAllRead, deleteNotification } from '../api/notificationApi';
import type { NotificationItem } from '../api/notificationApi';
import { Mail, MailOpen, User, Trash } from './icons';
import './NotificationButton.css';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'À l\'instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

const TYPE_ICON: Record<string, string> = {
  BADGE: '🏅',
  TRADE_RECEIVED: '⇄',
  TRADE_ACCEPTED: '✅',
  ATTENDANCE: '🎓',
};

const TYPE_COLOR: Record<string, string> = {
  BADGE: 'var(--rarity-legendary)',
  TRADE_RECEIVED: 'var(--accent)',
  TRADE_ACCEPTED: 'var(--success)',
  ATTENDANCE: 'var(--warning)',
  ADMIN_MESSAGE: 'var(--warning)',
};

export default function NotificationButton() {
  const { authenticated } = useUserCtx();
  const { triggerTradeAnim } = useTradeAnim();

  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Poll unread count every 2s
  useEffect(() => {
    if (!authenticated) return;
    const poll = () =>
      getUnreadCount()
        .then(({ count }) => setUnreadCount(count))
        .catch(() => {});
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [authenticated]);

  // Fetch full list when popover opens
  useEffect(() => {
    if (!open || !authenticated) return;
    getNotifications()
      .then(({ notifications: items }) => setNotifications(items))
      .catch(() => {});
  }, [open, authenticated]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function handleToggle() {
    setSpinning(true);
    setTimeout(() => setSpinning(false), 350);
    setOpen(prev => !prev);
  }

  function handleDismiss(id: string) {
    setDismissingIds(prev => new Set([...prev, id]));
    setTimeout(() => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setDismissingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      setUnreadCount(prev => Math.max(0, prev - 1));
      markRead(id).catch(() => {});
    }, 180);
  }

  function handleDelete(id: string) {
    setDismissingIds(prev => new Set([...prev, id]));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      setDismissingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      deleteNotification(id).catch(() => {});
    }, 180);
  }

  function handleReadAll() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    markAllRead().catch(() => {});
  }

  function handleViewTrade(n: NotificationItem) {
    const p = n.payload as {
      givenPokemonName: string;
      givenPokemonSprite: string;
      givenPokemonIsShiny: boolean;
      receivedPokemonName: string | null;
      receivedPokemonSprite: string | null;
      receivedPokemonIsShiny: boolean;
    };
    if (!p.receivedPokemonSprite || !p.receivedPokemonName) return;
    setOpen(false);
    triggerTradeAnim({
      givenPokemon: { sprite_url: p.givenPokemonSprite, name: p.givenPokemonName },
      receivedPokemon: { sprite_url: p.receivedPokemonSprite, name: p.receivedPokemonName },
      shinyProc: Boolean(p.receivedPokemonIsShiny),
      shinyPokemonName: p.receivedPokemonIsShiny ? p.receivedPokemonName : undefined,
    });
  }

  if (!authenticated) return null;

  const unread = notifications.filter(n => !n.read);
  const read = notifications.filter(n => n.read);
  const hasUnread = unread.length > 0;

  return (
    <div className="notif-wrapper" ref={wrapperRef}>
      <button
        className={`notif-btn${spinning ? ' notif-btn--spinning' : ''}`}
        onClick={handleToggle}
        aria-label="Notifications"
        aria-expanded={open}
      >
        {open ? <MailOpen size={26} aria-hidden /> : <Mail size={26} aria-hidden />}
        {unreadCount > 0 && (
          <span className="notif-badge" key={unreadCount}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-popover" role="dialog" aria-label="Notifications">
          <div className="notif-header">
            <span className="notif-header-title">Messages</span>
            {hasUnread && (
              <button className="notif-read-all" onClick={handleReadAll}>
                Tout lire
              </button>
            )}
          </div>

          <div className="notif-body">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <span className="notif-empty-icon">✉️</span>
                <span>Aucun message</span>
              </div>
            ) : (
              <>
                {hasUnread && (
                  <>
                    <div className="notif-section-label">Non lus</div>
                    {unread.map(n => (
                      <NotifItem
                        key={n.id}
                        n={n}
                        dismissing={dismissingIds.has(n.id)}
                        isRead={false}
                        onDismiss={handleDismiss}
                        onViewTrade={handleViewTrade}
                      />
                    ))}
                  </>
                )}

                {read.length > 0 && (
                  <>
                    {hasUnread && <div className="notif-divider" />}
                    <div className="notif-section-label">Lus</div>
                    {read.map(n => (
                      <NotifItem
                        key={n.id}
                        n={n}
                        dismissing={false}
                        isRead={true}
                        onDismiss={handleDismiss}
                        onDelete={handleDelete}
                        onViewTrade={handleViewTrade}
                      />
                    ))}
                  </>
                )}

                {!hasUnread && read.length === 0 && (
                  <div className="notif-empty">
                    <span className="notif-empty-icon">✉️</span>
                    <span>Aucun message</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface NotifItemProps {
  n: NotificationItem;
  dismissing: boolean;
  isRead: boolean;
  onDismiss: (id: string) => void;
  onDelete?: (id: string) => void;
  onViewTrade: (n: NotificationItem) => void;
}

function NotifItem({ n, dismissing, isRead, onDismiss, onDelete, onViewTrade }: NotifItemProps) {
  const itemClass = [
    'notif-item',
    isRead ? 'notif-item--read' : 'notif-item--unread',
    dismissing ? 'notif-item--dismissing' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={itemClass}>
      <div
        className="notif-icon"
        style={{ color: TYPE_COLOR[n.type] ?? 'var(--text-muted)' }}
      >
        {n.type === 'ADMIN_MESSAGE'
          ? <User size={17} aria-hidden />
          : (TYPE_ICON[n.type] ?? '📬')}
      </div>

      <div className="notif-content">
        <NotifBody n={n} onViewTrade={onViewTrade} />
        <div className="notif-time">{relativeTime(n.created_at)}</div>
      </div>

      {!isRead && (
        <button
          className="notif-dismiss"
          onClick={() => onDismiss(n.id)}
          aria-label="Marquer comme lu"
        >
          ×
        </button>
      )}
      {isRead && onDelete && (
        <button
          className="notif-delete"
          onClick={() => onDelete(n.id)}
          aria-label="Supprimer"
        >
          <Trash size={13} aria-hidden />
        </button>
      )}
    </div>
  );
}

function NotifBody({ n, onViewTrade }: { n: NotificationItem; onViewTrade: (n: NotificationItem) => void }) {
  switch (n.type) {
    case 'BADGE': {
      const p = n.payload as { badgeName?: string; badgeDescription?: string };
      return (
        <>
          <div className="notif-text">
            Badge débloqué : <strong>{p.badgeName ?? '?'}</strong>
          </div>
          {p.badgeDescription && (
            <div className="notif-subtext">{p.badgeDescription}</div>
          )}
        </>
      );
    }

    case 'TRADE_RECEIVED': {
      const p = n.payload as { fromUserName?: string; fromPokemonName?: string; toPokemonName?: string | null };
      return (
        <div className="notif-text">
          <strong>{p.fromUserName ?? '?'}</strong> te propose un échange
          {p.fromPokemonName ? (
            <> : {p.fromPokemonName}{p.toPokemonName ? ` → ${p.toPokemonName}` : ''}</>
          ) : null}
        </div>
      );
    }

    case 'TRADE_ACCEPTED': {
      const p = n.payload as {
        accepterName?: string;
        receivedPokemonName?: string | null;
        receivedPokemonSprite?: string | null;
      };
      return (
        <>
          <div className="notif-text">
            <strong>{p.accepterName ?? '?'}</strong> a accepté ton échange !
          </div>
          {p.receivedPokemonSprite && p.receivedPokemonName && (
            <button className="notif-action-btn" onClick={() => onViewTrade(n)}>
              Voir l'échange
            </button>
          )}
        </>
      );
    }

    case 'ATTENDANCE': {
      const p = n.payload as { message?: string };
      return <div className="notif-text">{p.message ?? 'Check présence disponible !'}</div>;
    }

    case 'ADMIN_MESSAGE': {
      const p = n.payload as { content?: string };
      return (
        <div className="notif-text notif-text--admin">
          <span className="notif-admin-label">Admin</span>
          {p.content ?? ''}
        </div>
      );
    }

    default:
      return null;
  }
}
