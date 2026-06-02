import { ReactNode } from 'react';
import { getToken } from '../api/client';
import MicrosoftLoginButton from './MicrosoftLoginButton';

interface Props {
  children: ReactNode;
  message?: string;
}

export default function AuthGuard({ children, message }: Props) {
  if (!getToken()) {
    return <MicrosoftLoginButton message={message ?? 'Connecte-toi pour accéder à cette page.'} />;
  }
  return <>{children}</>;
}
