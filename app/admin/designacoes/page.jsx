'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { LifeMinistryTab } from '@/app/components/designacoes/LifeMinistryTab';
import { PublicSpeechTab } from '@/app/components/designacoes/PublicSpeechTab';
import { MechanicalPrivilegesTab } from '@/app/components/designacoes/MechanicalPrivilegesTab';
import { PublisherSummaryModal } from '@/app/components/designacoes/PublisherSummaryModal';
import { Loader2 } from 'lucide-react';

function DesignacoesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const highlightId = searchParams.get('highlight');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // If there is a highlight ID in the URL, open the modal
    if (highlightId) {
      setIsModalOpen(true);
    }
  }, [highlightId]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Remove the query parameter without refreshing the page
    const params = new URLSearchParams(searchParams);
    params.delete('highlight');
    router.replace(`/admin/designacoes${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
      <div className="p-2 space-y-4">
         <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Designações</h1>
            <p className="text-gray-500">Planeje e organize as reuniões e privilégios.</p>
         </div>

         <Tabs defaultValue="vida-ministerio" className="w-full">
            <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 h-auto max-w-lg mb-4 gap-2">
              <TabsTrigger value="vida-ministerio">Vida e Ministério</TabsTrigger>
              <TabsTrigger value="discursos-publicos">Discursos Públicos</TabsTrigger>
              <TabsTrigger value="privilegios-mecanicos">Privilégios Mecânicos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="vida-ministerio">
               <LifeMinistryTab />
            </TabsContent>
            
            <TabsContent value="discursos-publicos">
               <PublicSpeechTab />
            </TabsContent>
            
            <TabsContent value="privilegios-mecanicos">
               <MechanicalPrivilegesTab />
            </TabsContent>
         </Tabs>

         <PublisherSummaryModal 
            publisherId={highlightId} 
            isOpen={isModalOpen} 
            onClose={handleCloseModal} 
         />
      </div>
  );
}

export default function DesignacoesPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin text-purple-600" /></div>}>
        <DesignacoesContent />
      </Suspense>
    </DashboardLayout>
  );
}