import { DashboardLayout } from '@/app/components/DashboardLayout';
import PersonalPortal from '@/app/components/PersonalPortal';
import AssignmentConfirmations from '@/app/components/designacoes/AssignmentConfirmations';
export default function Page() { return <DashboardLayout><PersonalPortal section="assignments" /><div className="p-4"><AssignmentConfirmations /></div></DashboardLayout>; }
