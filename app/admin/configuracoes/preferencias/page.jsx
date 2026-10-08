'use client';

import { DashboardLayout } from '@/app/components/DashboardLayout';
import { PersonalAlertSettingsCard } from '@/app/components/PersonalAlertSettingsCard';

export default function PreferencesPage() {
    return <DashboardLayout><div className="mx-auto w-full min-w-0 max-w-3xl space-y-5 p-3 sm:p-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Minhas configurações</h1><p className="mt-1 text-sm text-gray-500">Escolha como deseja receber seus lembretes.</p></div>
        <PersonalAlertSettingsCard />
    </div></DashboardLayout>;
}
