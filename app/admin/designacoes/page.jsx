'use client';

import { DashboardLayout } from '@/app/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { LifeMinistryTab } from '@/app/components/designacoes/LifeMinistryTab';
import { PublicSpeechTab } from '@/app/components/designacoes/PublicSpeechTab';
import { MechanicalPrivilegesTab } from '@/app/components/designacoes/MechanicalPrivilegesTab';

export default function DesignacoesPage() {
  return (
    <DashboardLayout>
      <div className="p-2 space-y-4">
         <div>
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
      </div>
    </DashboardLayout>
  );
}