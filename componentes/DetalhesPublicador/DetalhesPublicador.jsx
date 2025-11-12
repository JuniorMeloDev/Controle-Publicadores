'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Printer } from 'lucide-react';
import FormularioInformacoes from '@/componentes/DetalhesPublicador/FormularioInformacoes';
import AtividadesTeocraticas from '@/componentes/DetalhesPublicador/AtividadesTeocraticas';
import RelatorioImprimivel from './RelatorioImprimivel';

export default function DetalhesPublicador({ publicadorId, onSaveSuccess }) {
  const [activeTab, setActiveTab] = useState('informacoes');
  const [gruposList, setGruposList] = useState([]);  
  const [formData, setFormData] = useState({
    nome_completo: '', data_nascimento: '', data_batismo: '', nome_grupo: '',
    sexo: '', esperanca: '',
    senha: '', privilegios: [], designacoes: [],
    telefone: '', email: '', cep: '', logradouro: '',
    numero: '', complemento: '', bairro: '', cidade: '', estado: ''
  });
  
  const [relatorios, setRelatorios] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  
  const numeroInputRef = useRef(null);
  const printRef = useRef(null);

  useEffect(() => {
    if (!publicadorId) {
      setIsPageLoading(false);
      return;
    }
    
    const fetchTudo = async () => {
      setIsPageLoading(true);
      setMessage('');
      setIsError(false);
      try {
        const gruposRes = await fetch('/api/get-grupos');
        if (!gruposRes.ok) throw new Error('Falha ao carregar grupos.');
        const gruposData = await gruposRes.json();
        setGruposList(gruposData);

        const pubRes = await fetch(`/api/admin/get-publicador/${publicadorId}`);
        if (!pubRes.ok) throw new Error('Falha ao carregar dados do publicador.');
        const pubData = await pubRes.json();

        setFormData({
          ...pubData,
          data_nascimento: pubData.data_nascimento || '',
          data_batismo: pubData.data_batismo || '',
          sexo: pubData.sexo || '',
          esperanca: pubData.esperanca || '',
          telefone: pubData.telefone || '',
          email: pubData.email || '',
          cep: pubData.cep || '',
          logradouro: pubData.logradouro || '',
          numero: pubData.numero || '',
          complemento: pubData.complemento || '',
          bairro: pubData.bairro || '',
          cidade: pubData.cidade || '',
          estado: pubData.estado || '',
          senha: '', 
          privilegios: pubData.privilegios || [],
          designacoes: pubData.designacoes || [],
        });

        const relRes = await fetch(`/api/admin/get-relatorios/${publicadorId}`);
        if (!relRes.ok) throw new Error('Falha ao buscar relatórios');
        const relData = await relRes.json();
        setRelatorios(relData);

      } catch (err) {
        console.error(err);
        setMessage('Erro ao carregar dados. ' + err.message);
        setIsError(true);
      } finally {
        setIsPageLoading(false);
      }
    };

    fetchTudo();
  }, [publicadorId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
  };

  const handleMaskChange = (value, name) => {
    setFormData(prevData => ({ ...prevData, [name]: value }));
    if (name === 'cep') setCepError('');
  };

  const handlePrivilegioChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prevData => {
      if (checked) return { ...prevData, privilegios: [...prevData.privilegios, value] };
      return { ...prevData, privilegios: prevData.privilegios.filter(p => p !== value) };
    });
  };

  const handleDesignacaoChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prevData => {
      if (checked) return { ...prevData, designacoes: [...prevData.designacoes, value] };
      return { ...prevData, designacoes: prevData.designacoes.filter(d => d !== value) };
    });
  };

  const handleCepBlur = async () => {
    const cep = formData.cep.replace(/\D/g, ''); 
    if (cep.length !== 8) { setCepError(''); return; }
    setIsCepLoading(true);
    setCepError('');
    try {
      const response = await fetch(`/api/get-cep/${cep}`, { cache: 'no-store' }); 
      const data = await response.json();
      if (!response.ok || data.erro) throw new Error(data.message || 'CEP não encontrado.');
      setFormData(prev => ({
        ...prev, logradouro: data.logradouro, bairro: data.bairro,
        cidade: data.localidade, estado: data.uf, complemento: ''
      }));
      numeroInputRef.current?.focus();
    } catch (err) {
      setCepError(err.message);
      setFormData(prev => ({
        ...prev, logradouro: '', bairro: '', cidade: '', estado: '',
      }));
    } finally {
      setIsCepLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setIsError(false);
    
    try {
      const response = await fetch(`/api/admin/update-publicador/${publicadorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData) 
      });
      
      const data = await response.json();

      if (response.ok) {
        setMessage('Publicador alterado com sucesso');
        setIsError(false);
        onSaveSuccess();
      } else {
        setMessage(data.message || 'Ocorreu um erro.');
        setIsError(true);
      }
    } catch (err) {
      setMessage('Não foi possível conectar ao servidor.');
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Função de impressão simples (sem react-to-print)
  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open('', '', 'height=600,width=800');
      printWindow.document.write('<html><head><title>' + formData.nome_completo + '</title>');
      printWindow.document.write('<style>');
      printWindow.document.write('@import url("https://cdn.tailwindcss.com");');
      printWindow.document.write('body { color: #000; background: #fff; }');
      printWindow.document.write('</style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write(printRef.current.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (isPageLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 h-full">
        <Loader2 className="size-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-8">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-700">
        <div>
          <h2 className="text-3xl font-bold text-white">
            {formData.nome_completo || 'Editar Publicador'}
          </h2>
          <p className="text-neutral-400 text-sm mt-1">
            ID do Publicador: {publicadorId}
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold text-neutral-100 bg-neutral-700 hover:bg-neutral-600 transition-colors"
        >
          <Printer size={18} />
          Imprimir
        </button>
      </div>
      
      {message && (
        <div className={`p-3 rounded-md mb-6 text-sm ${isError 
          ? 'bg-red-900 bg-opacity-30 text-red-300 border border-red-800' 
          : 'bg-green-900 bg-opacity-30 text-green-300 border border-green-800'}`
        }>
          {message}
        </div>
      )}

      <div className="border-b border-neutral-700">
        <nav className="-mb-px flex space-x-6" aria-label="Abas">
          <button
            onClick={() => setActiveTab('informacoes')}
            className={`${activeTab === 'informacoes' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-neutral-400 hover:border-neutral-500 hover:text-neutral-300'}
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Informações Pessoais
          </button>
          <button
            onClick={() => setActiveTab('atividades')}
            className={`${activeTab === 'atividades' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-neutral-400 hover:border-neutral-500 hover:text-neutral-300'}
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Atividades Teocráticas
          </button>
        </nav>
      </div>

      {activeTab === 'informacoes' && (
        <FormularioInformacoes
          formData={formData}
          setFormData={setFormData}
          handleSubmit={handleSubmit}
          handleChange={handleChange}
          handleMaskChange={handleMaskChange}
          handlePrivilegioChange={handlePrivilegioChange}
          handleDesignacaoChange={handleDesignacaoChange}
          handleCepBlur={handleCepBlur}
          gruposList={gruposList}
          isLoading={isLoading}
          isCepLoading={isCepLoading}
          cepError={cepError}
          numeroInputRef={numeroInputRef}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
        />
      )}

      {activeTab === 'atividades' && (
        <AtividadesTeocraticas 
          publicadorId={publicadorId} 
          publicadorNome={formData.nome_completo}
          relatorios={relatorios}
          publicador={formData}
        />
      )}

      {/* Componente de Impressão (oculto) */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <RelatorioImprimivel 
            publicador={formData} 
            relatorios={relatorios} 
          />
        </div>
      </div>
    </div>
  );
}