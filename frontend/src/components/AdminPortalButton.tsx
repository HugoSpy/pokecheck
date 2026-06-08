import { useNavigate } from 'react-router-dom';
import { Shield } from './icons';
import './AdminPortalButton.css';

export default function AdminPortalButton() {
  const navigate = useNavigate();

  return (
    <button
      className="ap-portal-btn"
      onClick={() => navigate('/admin')}
      title="Admin Portal"
    >
      <Shield size={14} />
      <span>Admin</span>
    </button>
  );
}
