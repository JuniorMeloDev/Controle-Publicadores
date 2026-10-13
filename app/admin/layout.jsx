import { UserSessionProvider } from '@/app/components/UserSessionProvider';

export default function AdminLayout({ children }) {
  return <UserSessionProvider>{children}</UserSessionProvider>;
}
