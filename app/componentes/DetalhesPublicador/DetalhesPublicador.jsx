'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Printer, X, Lock, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { StatusToast } from '@/app/components/ui/status-toast';
import FormularioInformacoes from '@/app/componentes/DetalhesPublicador/FormularioInformacoes';
import AtividadesTeocraticas from '@/app/componentes/DetalhesPublicador/AtividadesTeocraticas';

import HistoricoPublicador from './HistoricoPublicador';
import { jsPDF } from "jspdf";


function formatDateForForm(date) {
  if (!date) return '';
  const dateString = String(date).trim();
  if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) return dateString;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const dLocal = new Date(d.valueOf() + d.getTimezoneOffset() * 60000);
    const year = dLocal.getFullYear();
    const month = String(dLocal.getMonth() + 1).padStart(2, '0');
    const day = String(dLocal.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  } catch (e) { return ''; }
}

export default function DetalhesPublicador({
  publicadorId, onSaveSuccess, onClose,
  persistedMessage,
  persistedError,
  onMessageDismiss,
  initialTab = 'informacoes'
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [gruposList, setGruposList] = useState([]);
  const [formData, setFormData] = useState({
    nome_completo: '', nome_chamado: '',
    data_nascimento: '', data_batismo: '', nome_grupo: '',
    sexo: '', esperanca: '',
    senha: '', privilegios: [], designacoes: [],
    telefone: '', email: '', cep: '', logradouro: '',
    numero: '', complemento: '', bairro: '', cidade: '', estado: ''
  });

  const [relatorios, setRelatorios] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  // --- ESTADOS DE PERMISSÃO ---
  // Inicializa com null para diferenciar "não carregado" de "sem permissão"
  const [currentUser, setCurrentUser] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });

  const numeroInputRef = useRef(null);

  const message = persistedMessage;
  const isError = persistedError;

  // Busca dados do usuário logado
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const res = await fetch('/api/usuario-atual');
        if (res.ok) {
          const data = await res.json();
          // Garante que o ID no estado seja string para facilitar comparação
          setCurrentUser({ ...data, id: String(data.id) });
        } else {
          // Se falhar, define um usuário vazio para não travar
          setCurrentUser({ isAnciao: false, isServo: false, id: '' });
        }
      } catch (error) {
        console.error("Erro ao verificar permissões", error);
        setCurrentUser({ isAnciao: false, isServo: false, id: '' });
      }
    };
    checkPermission();
  }, []);

  // --- LÓGICA DE PERMISSÃO ROBUSTA ---

  // Só calcula se o usuário já foi carregado
  let canViewActivities = false;
  let canEditActivities = false;

  if (currentUser) {
    const currentUserIdStr = String(currentUser.id || '').trim();
    const publicadorIdStr = String(publicadorId || '').trim();

    canViewActivities =
      currentUser.isAnciao || // Ancião vê tudo
      (currentUser.isServo && currentUserIdStr === publicadorIdStr); // Servo vê apenas a sua

    canEditActivities = currentUser.isAnciao; // Apenas Ancião edita
  }
  // --------------------------------------

  const fetchTudo = useCallback(async (isRefresh = false) => {
    if (!publicadorId) { setIsPageLoading(false); return; }
    if (isRefresh) { setIsLoading(true); } else { setIsPageLoading(true); }

    try {
      const [gruposRes, pubRes] = await Promise.all([
        fetch('/api/get-grupos'),
        fetch(`/api/admin/get-publicador/${publicadorId}`)
      ]);

      if (!gruposRes.ok) throw new Error('Falha ao carregar grupos.');
      const gruposData = await gruposRes.json();
      setGruposList(gruposData);

      if (!pubRes.ok) throw new Error('Falha ao carregar dados do publicador.');
      const pubData = await pubRes.json();

      setFormData({
        ...pubData,
        data_nascimento: formatDateForForm(pubData.data_nascimento) || '',
        data_batismo: formatDateForForm(pubData.data_batismo) || '',
        nome_chamado: pubData.nome_chamado || '',
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
      console.error('Erro ao carregar dados do publicador:', err);
    } finally {
      setIsPageLoading(false);
      setIsLoading(false);
    }
  }, [publicadorId]);

  useEffect(() => {
    if (publicadorId) fetchTudo(false);
  }, [publicadorId, fetchTudo]);

  const handleCepBlur = async () => { if (message) onMessageDismiss(); };
  const handleChange = (e) => {
    if (message) onMessageDismiss();
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
  };
  const handleMaskChange = (value, name) => {
    if (message) onMessageDismiss();
    setFormData(prevData => ({ ...prevData, [name]: value }));
    if (name === 'cep') setCepError('');
  };
  const handlePrivilegioChange = (e) => {
    if (message) onMessageDismiss();
    const { value, checked } = e.target;
    setFormData(prevData => {
      if (checked) return { ...prevData, privilegios: [...prevData.privilegios, value] };
      return { ...prevData, privilegios: prevData.privilegios.filter(p => p !== value) };
    });
  };
  const handleDesignacaoChange = (e) => {
    if (message) onMessageDismiss();
    const { value, checked } = e.target;
    setFormData(prevData => {
      if (checked) return { ...prevData, designacoes: [...prevData.designacoes, value] };
      return { ...prevData, designacoes: prevData.designacoes.filter(d => d !== value) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    onMessageDismiss();
    try {
      const response = await fetch(`/api/admin/update-publicador/${publicadorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (response.ok) {
        await fetchTudo(true);
        onSaveSuccess({ message: 'Publicador alterado com sucesso', isError: false, keepOpen: true });
      } else {
        onSaveSuccess({ message: data?.message || 'Erro ao salvar', isError: true, keepOpen: true });
      }
    } catch (err) {
      onSaveSuccess({ message: 'Não foi possível conectar ao servidor.', isError: true, keepOpen: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePublicador = () => {
    setDeleteDialogOpen(true);
  };

  const executeDeletePublicador = async () => {
    const publicadorIdValue = Number(String(publicadorId || '').trim());
    if (!publicadorIdValue || Number.isNaN(publicadorIdValue)) {
      setToast({ message: 'ID de publicador inválido.', type: 'error' });
      return;
    }

    setIsLoading(true);
    onMessageDismiss();
    try {
      const response = await fetch('/api/admin/delete-publicador', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicadorId: publicadorIdValue })
      });
      const data = await response.json();
      if (!response.ok) {
        onSaveSuccess({ message: data?.message || 'Erro ao excluir publicador.', isError: true, keepOpen: true });
        return;
      }
      setDeleteDialogOpen(false);
      onSaveSuccess({ message: data.message || 'Publicador excluído com sucesso.', isError: false, keepOpen: false });
      onClose();
    } catch (err) {
      onSaveSuccess({ message: 'Não foi possível conectar ao servidor.', isError: true, keepOpen: true });
    } finally {
      setIsLoading(false);
    }
  };


  // --- GERADOR PDF S-21 ---
  const generateS21PDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Configurações
    const startX = 10; // Margem esquerda
    const startY = 10; // Margem topo
    const pageW = 210;
    const width = pageW - (startX * 2); // Largura útil (190mm)
    const rowH = 7; // Altura da linha da tabela

    // Dados
    const currentServiceYear = new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear();
    // Tenta pegar o ano definido na visualização (não temos no estado global, usando fallback)
    const anoServico = currentServiceYear;

    // Helper para desenhar checkbox
    const drawCheckbox = (x, y, label, checked) => {
      const size = 3.5;
      doc.setDrawColor(0);
      doc.setFillColor(255, 255, 255);
      doc.rect(x, y - size + 0.5, size, size, 'FD'); // Quadrado
      if (checked) {
        doc.setFillColor(0); // Preto
        doc.rect(x + 0.5, y - size + 1, size - 1, size - 1, 'F'); // Preenchimento
      }
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(label, x + size + 1, y);
    };

    // --- Título ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("REGISTRO DE PUBLICADOR DE CONGREGAÇÃO", pageW / 2, startY + 5, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Ano de Serviço: ${anoServico}`, pageW / 2, startY + 10, { align: "center" });

    let cursorY = startY + 15;

    // --- Box Dados Pessoais ---
    doc.setLineWidth(0.4);
    doc.rect(startX, cursorY, width, 35); // Box principal

    // Linha 1: Nome e Nascimento
    let lineY = cursorY + 5;
    doc.setFontSize(7);
    doc.text("NOME:", startX + 2, lineY);
    doc.text("DATA DE NASCIMENTO:", startX + 110, lineY);

    lineY += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(formData.nome_completo || "", startX + 2, lineY);
    doc.text(formData.data_nascimento || "", startX + 110, lineY);

    doc.setLineWidth(0.1);
    doc.line(startX + 2, lineY + 1, startX + 100, lineY + 1); // Linha abaixo do nome
    doc.line(startX + 110, lineY + 1, startX + 160, lineY + 1); // Linha abaixo data nasc

    // Linha 2: Batismo e Checkboxes
    lineY += 8;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("DATA DE BATISMO:", startX + 2, lineY);

    // Checkboxes Sexo / Esperança
    drawCheckbox(startX + 60, lineY, "Masculino", formData.sexo === "Masculino");
    drawCheckbox(startX + 85, lineY, "Feminino", formData.sexo === "Feminino");

    drawCheckbox(startX + 60, lineY + 5, "Outras Ovelhas", formData.esperanca === "Outras Ovelhas");
    drawCheckbox(startX + 85, lineY + 5, "Ungido", formData.esperanca === "Ungido");

    lineY += 5;
    doc.setFontSize(10);
    doc.text(formData.data_batismo || "", startX + 2, lineY);
    doc.setLineWidth(0.1);
    doc.line(startX + 2, lineY + 1, startX + 50, lineY + 1);

    // Linha 3: Privilégios (Separador)
    lineY += 6;
    doc.setLineWidth(0.1);
    doc.line(startX, lineY - 3, startX + width, lineY - 3); // Linha horizontal divisória

    const privs = formData.privilegios || [];
    const desigs = formData.designacoes || [];

    drawCheckbox(startX + 2, lineY + 1, "Ancião", privs.includes("anciao"));
    drawCheckbox(startX + 25, lineY + 1, "Servo Ministerial", privs.includes("servo_ministerial"));
    drawCheckbox(startX + 60, lineY + 1, "Pioneiro Regular", desigs.includes("pioneiro_regular"));
    drawCheckbox(startX + 95, lineY + 1, "Pioneiro Especial", desigs.includes("pioneiro_especial"));
    drawCheckbox(startX + 130, lineY + 1, "Missionário", desigs.includes("missionario"));

    cursorY += 40; // Espaço após box dados pessoais

    // --- TABELA ---
    const cols = [25, 25, 20, 20, 20, 80]; // Larguras: Mês, Check1, Num1, Check2, Num2, Obs
    const headers = ["Mês", "Participou no\nministério", "Estudos\nbíblicos", "Pioneiro\nauxiliar", "Horas", "Observações"];

    // Cabeçalho Tabela
    let tableY = cursorY;
    const headerH = 10;

    doc.setLineWidth(0.3);
    doc.setFillColor(240, 240, 240); // Cinza claro
    doc.rect(startX, tableY, width, headerH, 'FD'); // Box Header

    let currentX = startX;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");

    // Desenha textos e linhas verticais do cabeçalho
    headers.forEach((h, i) => {
      const colW = cols[i];
      doc.text(h, currentX + (colW / 2), tableY + 3, { align: "center", baseline: "top" });

      if (i > 0) doc.line(currentX, tableY, currentX, tableY + headerH); // Linha vertical esquerda
      currentX += colW;
    });

    tableY += headerH;

    // Linhas dos Meses
    const meses = [
      'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Janeiro', 'Fevereiro',
      'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto'
    ];

    // Filtra relatórios do ano correto
    const yearReports = relatorios.filter(r => Number(r.ano_servico) === Number(anoServico));
    const relMap = new Map(yearReports.map(r => [r.mes, r]));

    let totalHoras = 0;
    let totalEstudos = 0; // Se quiser somar
    let participouCount = 0;
    let auxCount = 0;

    meses.forEach((mes) => {
      const rel = relMap.get(mes);
      const participou = rel?.participou_ministerio;
      const aux = rel?.pioneiro_auxiliar;
      const horas = rel?.horas ? Number(rel.horas) : 0;
      const estudos = rel?.estudos_biblicos ? Number(rel.estudos_biblicos) : 0;
      const obs = rel?.observacoes || "";

      if (participou) participouCount++;
      if (aux) auxCount++;
      totalHoras += horas;

      // Retângulo da linha
      doc.rect(startX, tableY, width, rowH);

      // Colunas
      currentX = startX;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      // 1. Mês
      doc.text(mes, currentX + 2, tableY + 4.5);
      currentX += cols[0];

      // 2. Participou (Check)
      doc.line(currentX, tableY, currentX, tableY + rowH);
      if (participou) {
        // Desenha quadradinho preenchido centralizado
        const boxS = 3;
        const boxX = currentX + (cols[1] / 2) - (boxS / 2);
        const boxY = tableY + (rowH / 2) - (boxS / 2);
        doc.setFillColor(0);
        doc.rect(boxX, boxY, boxS, boxS, 'F');
      }
      currentX += cols[1];

      // 3. Estudos
      doc.line(currentX, tableY, currentX, tableY + rowH);
      if (estudos > 0) doc.text(String(estudos), currentX + (cols[2] / 2), tableY + 4.5, { align: "center" });
      currentX += cols[2];

      // 4. Pioneiro Aux (Check)
      doc.line(currentX, tableY, currentX, tableY + rowH);
      if (aux) {
        const boxS = 3;
        const boxX = currentX + (cols[3] / 2) - (boxS / 2);
        const boxY = tableY + (rowH / 2) - (boxS / 2);
        doc.setFillColor(0);
        doc.rect(boxX, boxY, boxS, boxS, 'F');
      }
      currentX += cols[3];

      // 5. Horas
      doc.line(currentX, tableY, currentX, tableY + rowH);
      if (horas > 0) doc.text(String(horas), currentX + (cols[4] / 2), tableY + 4.5, { align: "center" });
      currentX += cols[4];

      // 6. Obs
      doc.line(currentX, tableY, currentX, tableY + rowH);
      if (obs) {
        doc.setFontSize(6);
        doc.text(obs, currentX + 2, tableY + 4.5);
      }

      tableY += rowH;
    });

    // --- Totais ---
    doc.setFillColor(240, 240, 240);
    doc.rect(startX, tableY, width, rowH, 'FD');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);

    currentX = startX;
    doc.text("TOTAL", currentX + cols[0] - 2, tableY + 4.5, { align: "right" });
    currentX += cols[0];

    // Participou Count
    doc.line(currentX, tableY, currentX, tableY + rowH);
    doc.text(String(participouCount), currentX + (cols[1] / 2), tableY + 4.5, { align: "center" });
    currentX += cols[1];

    // Estudos (em branco ou soma)
    doc.line(currentX, tableY, currentX, tableY + rowH);
    currentX += cols[2];

    // Aux Count
    doc.line(currentX, tableY, currentX, tableY + rowH);
    doc.text(String(auxCount), currentX + (cols[3] / 2), tableY + 4.5, { align: "center" });
    currentX += cols[3];

    // Horas Total
    doc.line(currentX, tableY, currentX, tableY + rowH);
    doc.text(String(totalHoras), currentX + (cols[4] / 2), tableY + 4.5, { align: "center" });
    currentX += cols[4];

    doc.line(currentX, tableY, currentX, tableY + rowH);

    // Rodapé
    doc.setFontSize(6);
    doc.text("Impresso via Sistema de Gestão Congregacional", startX, tableY + 12);

    // Save
    const safeName = formData.nome_chamado || "publicador";
    doc.save(`S21_${safeName.replace(/\s+/g, '_')}_${anoServico}.pdf`);
  };

  // --- GERADOR PDF LINHA DO TEMPO ---
  const generateTimelinePDF = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/get-historico/${publicadorId}`);
      if (!res.ok) throw new Error('Falha ao buscar histórico');
      const historyData = await res.json();

      const doc = new jsPDF();
      let yPos = 20;
      const margin = 20;
      const lineX = 25; // Posição X da linha vertical

      // --- CABEÇALHO ---
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Histórico do Publicador", 105, yPos, { align: "center" });
      yPos += 8;

      doc.setFontSize(12);
      doc.text(formData.nome_completo || "Publicador", 105, yPos, { align: "center" });
      yPos += 15;

      doc.setLineWidth(0.5);
      doc.line(margin, yPos, 190, yPos);
      yPos += 10;

      if (historyData.length === 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("Nenhum histórico encontrado.", 105, yPos, { align: "center" });
        doc.save(`Historico_${(formData.nome_chamado || "pub").replace(/\s+/g, '_')}.pdf`);
        return;
      }

      // Dicionário de Campos (Cópia simplificada)
      const NOME_CAMPOS = {
        'nome_completo': 'Nome Completo', 'data_nascimento': 'Nascimento', 'data_batismo': 'Batismo',
        'sexo': 'Sexo', 'esperanca': 'Esperança', 'nome_grupo': 'Grupo de Campo',
        'telefone': 'Telefone', 'email': 'Email', 'cep': 'CEP', 'logradouro': 'Endereço',
        'numero': 'Número', 'complemento': 'Complemento', 'bairro': 'Bairro',
        'cidade': 'Cidade', 'estado': 'Estado (UF)', 'privilegios': 'Privilégios',
        'designacoes': 'Designações', 'senha': 'Senha',
      };

      const checkPageBreak = (needed = 20) => {
        if (yPos + needed > 280) {
          doc.addPage();
          yPos = 20;
        }
      };

      // Desenha a linha vertical completa (será "quebrada" visualmente pelos bullets)
      // Mas como é dinâmico, desenhamos por item ou uma linha contínua no fundo?
      // Melhor desenhar por item.

      doc.setFontSize(10);

      historyData.forEach((evento, index) => {
        checkPageBreak(30);

        // Desenha linha conectando ao anterior (se não for o primeiro da página/lista)
        // Simplificação: Linha cinza contínua à esquerda

        // --- CONTEÚDO ---
        const dataFormatada = new Date(evento.data_evento).toLocaleDateString('pt-BR');

        // Bullet
        doc.setFillColor(index === 0 ? 0 : 255); // Primeiro cheio, outros vazios (estilo) ou todos cheios
        doc.setFillColor(100, 100, 100);
        doc.circle(lineX, yPos + 2, 1.5, 'F');

        // Data
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.setFontSize(8);
        doc.text(dataFormatada, lineX + 6, yPos);

        // Título e Detalhes
        doc.setTextColor(0);
        doc.setFontSize(10);
        let titulo = "";
        let detalhe = "";

        if (evento.tipo_evento === 'designacao') {
          doc.setFont("helvetica", "bold");
          titulo = "Designação de Reunião";

          doc.setFont("helvetica", "normal");
          detalhe = `${evento.nome_parte} (${evento.descricao_semana || ''})`;
        } else {
          // Alteração
          doc.setFont("helvetica", "bold");
          const nomeCampo = NOME_CAMPOS[evento.campo_alterado] || evento.campo_alterado;
          titulo = `Atualização de ${nomeCampo}`;

          doc.setFont("helvetica", "normal");
          if (evento.campo_alterado === 'senha') {
            detalhe = "Senha redefinida";
          } else if (['privilegios', 'designacoes'].includes(evento.campo_alterado)) {
            detalhe = `Valor Atual: ${evento.valor_novo || 'Nenhum'}`;
          } else {
            detalhe = `${evento.valor_antigo || 'Vazio'} ➝ ${evento.valor_novo || 'Vazio'}`;
          }
        }

        // Renderiza Título
        doc.setFont("helvetica", "bold");
        doc.text(titulo, lineX + 6, yPos + 5);

        // Renderiza Detalhe (com quebra de linha se precisar)
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50);
        const splitDetalhe = doc.splitTextToSize(detalhe, 150);
        doc.text(splitDetalhe, lineX + 6, yPos + 10);

        // Atualiza Y
        const height = 15 + (splitDetalhe.length * 4);

        // Desenha linha vertical ligando até o próximo (exceto último)
        if (index < historyData.length - 1) {
          doc.setDrawColor(200);
          doc.setLineWidth(0.5);
          doc.line(lineX, yPos + 2, lineX, yPos + height);
        }

        yPos += height;
      });

      // Rodapé
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, 290, { align: "center" });

      doc.save(`Historico_${(formData.nome_chamado || "pub").replace(/\s+/g, '_')}.pdf`);

    } catch (error) {
      console.error(error);
      onSaveSuccess({ message: "Erro ao gerar PDF do histórico", isError: true, keepOpen: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    if (activeTab === 'atividades') {
      generateS21PDF();
      return;
    }

    if (activeTab === 'historico') {
      generateTimelinePDF();
      return;
    }

    const doc = new jsPDF();
    const margin = 20;
    let yPos = 20;

    // --- CABEÇALHO ---
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Ficha de Publicador", 105, yPos, { align: "center" });
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (formData.nome_grupo) {
      doc.text(`Grupo: ${formData.nome_grupo}`, 105, yPos, { align: "center" });
      yPos += 15;
    } else {
      yPos += 5;
    }

    const addSectionTitle = (title) => {
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos, 170, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(title, margin + 2, yPos + 6);
      yPos += 14;
    };

    const addField = (label, value, xOffset = 0) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`${label}:`, margin + xOffset, yPos);

      doc.setFont("helvetica", "normal");
      const valStr = value ? String(value) : "-";
      // Adiciona um pequeno espaçamento (2mm) após o label
      doc.text(valStr, margin + xOffset + doc.getTextWidth(`${label}:`) + 2, yPos);
    };

    // --- DADOS PESSOAIS ---
    addSectionTitle("Dados Pessoais");

    addField("Nome Completo", formData.nome_completo);
    yPos += 8;

    addField("Sexo", formData.sexo, 0);
    addField("Nascimento", formData.data_nascimento, 100);
    yPos += 12;

    // --- CONTATO E ENDEREÇO ---
    addSectionTitle("Contato e Endereço");

    addField("Telefone", formData.telefone, 0);
    addField("Email", formData.email, 100);
    yPos += 8;

    const endereco = [
      formData.logradouro ? `${formData.logradouro}, ${formData.numero}` : '',
      formData.complemento,
      formData.bairro,
      formData.cidade ? `${formData.cidade} - ${formData.estado}` : '',
      formData.cep ? `CEP: ${formData.cep}` : ''
    ].filter(Boolean).join(" - ");

    doc.setFont("helvetica", "bold");
    doc.text("Endereço:", margin, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");

    const splitEnd = doc.splitTextToSize(endereco || "-", 170);
    doc.text(splitEnd, margin, yPos);
    yPos += (splitEnd.length * 5) + 8;


    // --- DADOS ESPIRITUAIS ---
    addSectionTitle("Dados Espirituais");

    addField("Data de Batismo", formData.data_batismo, 0);
    addField("Esperança", formData.esperanca, 100);
    yPos += 8;

    // Privilégios (Só mostra se tiver)
    if (formData.privilegios && formData.privilegios.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Privilégios:", margin, yPos);

      const privs = formData.privilegios.join(", ");

      doc.setFont("helvetica", "normal");
      const splitPrivs = doc.splitTextToSize(privs, 140);
      doc.text(splitPrivs, margin + 25, yPos);
      yPos += (splitPrivs.length * 5) + 4;
    }

    // Designações
    const formatDesignacao = (d) => {
      const map = {
        'pioneiro_regular': 'Pioneiro Regular',
        'pioneiro_especial': 'Pioneiro Especial',
        'missionario': 'Missionário em Campo'
      };
      return map[d] || d; // Retorna o formatado ou o original se não achar
    };

    doc.setFont("helvetica", "bold");
    doc.text("Designações:", margin, yPos);

    const desigs = formData.designacoes && formData.designacoes.length > 0
      ? formData.designacoes.map(d => formatDesignacao(d)).join(", ")
      : "Nenhuma";

    doc.setFont("helvetica", "normal");
    const splitDesigs = doc.splitTextToSize(desigs, 140);
    doc.text(splitDesigs, margin + 28, yPos);
    yPos += 15;


    // Rodapé
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, 290, { align: "center" });

    // Salvar
    const safeName = formData.nome_chamado || "publicador";
    doc.save(`Ficha_${safeName.replace(/\s+/g, '_')}.pdf`);
  };

  useEffect(() => {
    if (!toast.message) return;
    const timer = setTimeout(() => setToast({ message: '', type: '' }), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (isPageLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 h-full bg-white">
        <Loader2 className="size-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      {/* CABEÇALHO */}
      <div className="shrink-0 p-6 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="flex-1 min-w-0 mr-4">
          <h2 className="text-2xl font-bold text-gray-900 truncate">
            {formData.nome_completo || 'Editar Publicador'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500 text-xs">ID: {publicadorId}</p>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500 text-xs">{formData.nome_grupo || 'Sem grupo'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Imprimir Ficha"
          >
            <Printer size={18} />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          <button
            onClick={handleDeletePublicador}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-white hover:bg-red-600 transition-colors"
            title="Excluir Publicador"
          >
            <Trash2 size={18} />
            <span className="hidden sm:inline">Excluir</span>
          </button>
        </div>
      </div>

      {toast.message && <StatusToast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-xl bg-white text-gray-900 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir este publicador? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(false)}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={executeDeletePublicador}
              disabled={isLoading}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isLoading ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CONTEÚDO ROLÁVEL */}
      <div className="flex-1 overflow-y-auto p-6">
        {message && (
          <div
            className={`p-3 rounded-md mb-6 text-sm cursor-pointer flex items-center justify-between ${isError
              ? 'bg-red-900/30 text-red-300 border border-red-800'
              : 'bg-green-900/30 text-green-300 border border-green-800'}`
            }
            onClick={onMessageDismiss}
          >
            <span>{message}</span>
            <X size={14} className="opacity-50" />
          </div>
        )}

        {/* ABAS */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-6" aria-label="Abas">
            <button
              onClick={() => setActiveTab('informacoes')}
              className={`${activeTab === 'informacoes' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Informações Pessoais
            </button>

            {/* --- BOTÃO DE ATIVIDADES --- */}
            {canViewActivities ? (
              <button
                onClick={() => setActiveTab('atividades')}
                className={`${activeTab === 'atividades' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Atividades Teocráticas
              </button>
            ) : (
              // Botão desativado (Com tooltip do motivo)
              <div className="flex items-center text-gray-300 py-3 px-1 border-b-2 border-transparent text-sm cursor-not-allowed" title="Acesso restrito a Anciãos ou ao próprio titular">
                <Lock size={12} className="mr-1" /> Atividades
              </div>
            )}

            <button
              onClick={() => setActiveTab('historico')}
              className={`${activeTab === 'historico' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Linha do Tempo
            </button>
          </nav>
        </div>

        {/* PAINÉIS DAS ABAS */}
        <div className="pb-10">
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

          {activeTab === 'atividades' && canViewActivities && (
            <AtividadesTeocraticas
              publicadorId={publicadorId}
              publicadorNome={formData.nome_completo}
              relatorios={relatorios}
              publicador={formData}
              onRefreshData={() => fetchTudo(true)}
              readOnly={!canEditActivities} // <-- Define se pode editar ou não
            />
          )}

          {activeTab === 'historico' && (
            <HistoricoPublicador
              publicadorId={publicadorId}
            />
          )}
        </div>
      </div>



    </div>
  );
}