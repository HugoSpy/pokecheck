interface Props {
  msg: string;
  type: 'success' | 'error';
  onClose: () => void;
}

/** Shared toast (fixed bottom-right, click to dismiss). Styles live in globals.css. */
export default function Toast({ msg, type, onClose }: Props) {
  return (
    <div
      className={`toast toast--${type}`}
      role="status"
      aria-live="polite"
      onClick={onClose}
    >
      {msg}
    </div>
  );
}
