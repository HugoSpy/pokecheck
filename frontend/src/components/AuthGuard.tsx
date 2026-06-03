import { ReactNode } from 'react';
import { useUserCtx } from '../context/UserContext';
import MicrosoftLoginButton from './MicrosoftLoginButton';

interface Props {
  children: ReactNode;
  message?: string;
}

export default function AuthGuard({ children, message }: Props) {
  const { loading, authenticated } = useUserCtx();

  if (loading) return null;
  if (!authenticated) {
    return <MicrosoftLoginButton message={message ?? 'Connecte-toi pour accéder à cette page.'} />;
  }
  return <>{children}</>;
}
