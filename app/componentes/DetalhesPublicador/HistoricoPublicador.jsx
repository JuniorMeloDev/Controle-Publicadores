'use client';

import { useState, useEffect } from 'react';
import { Loader2, Edit2, Calendar, User, ArrowRight, Shield, Star } from 'lucide-react';

/**
 * Formata uma string de data (ISO ou SQL) para o formato dd/mm/aaaa
 * Retorna null se a data for inválida ou vazia.
 */
function formatarData(dataString) {
  if (!dataString) return null; // Retorna null para campos vazios
  try {
    const data = new Date(dataString);
    // Adiciona o fuso horário para corrigir a data (comum em datas 'YYYY-MM-DD')
    const dataAjustada = new Date(data.valueOf() + data.getTimezoneOffset() * 60000);
    return dataAjustada.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch (e) {
    return dataString; // Retorna a string original se falhar
  }
}

// --- 1. NOVO DICIONÁRIO DE TRADUÇÃO ---
const NOME_CAMPOS = {
  'nome_completo': 'Nome Completo',
  'data_nascimento': 'Nascimento',
  'data_batismo': 'Batismo',
  'sexo': 'Sexo',
  'esperanca': 'Esperança',
  'nome_grupo': 'Grupo de Campo',
  'telefone': 'Telefone',
  'email': 'Email',
  'cep': 'CEP',
  'logradouro': 'Endereço',
  'numero': 'Número',
  'complemento': 'Complemento',
  'bairro': 'Bairro',
  'cidade': 'Cidade',
  'estado': 'Estado (UF)',
  'privilegios': 'Privilégios',
  'designacoes': 'Designações',
  'senha': 'Senha',
};
// --- FIM DO DICIONÁRIO ---


/**
 * Renderiza um evento de designação da reunião
 */
function EventoDesignacao({ evento }) {
  // ... (Esta função permanece idêntica)
  return (
    <>
      <div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 ring-8 ring-white">
          <Calendar className="h-5 w-5 text-white" aria-hidden="true" />
        </span>
      </div>
      <div className="min-w-0 flex-1 justify-between space-x-4 pt-1.5">
        <div>
          <p className="text-sm text-gray-500">
            Designação de Reunião em <time dateTime={evento.data_evento}>{formatarData(evento.data_evento)}</time>
          </p>
          <p className="mt-0.5 text-sm text-gray-900 font-bold">
            {evento.nome_parte}
          </p>
          <p className="text-xs text-gray-600 font-medium">{evento.descricao_semana}</p>
        </div>
      </div>
    </>
  );
}

/**
 * Renderiza um evento de alteração de dados pessoais
 */
function EventoPessoal({ evento }) {
  let Icon = Edit2;
  let titulo; // Será definido no switch

  // Pega os valores brutos
  let valorAntigo = evento.valor_antigo || 'vazio';
  let valorNovo = evento.valor_novo || 'vazio';

  // Formata datas
  if (evento.campo_alterado === 'data_nascimento' || evento.campo_alterado === 'data_batismo') {
    valorAntigo = formatarData(evento.valor_antigo) || 'vazio';
    valorNovo = formatarData(evento.valor_novo) || 'vazio';
  }

  // --- 2. LÓGICA DO TÍTULO ATUALIZADA ---
  switch (evento.campo_alterado) {
    case 'privilegios':
      Icon = Shield;
      titulo = 'Privilégios atualizados';
      valorNovo = valorNovo === 'vazio' ? 'Nenhum' : valorNovo;
      valorAntigo = valorAntigo === 'vazio' ? 'Nenhum' : valorAntigo;
      break;
    case 'designacoes':
      Icon = Star;
      titulo = 'Designações atualizadas';
      valorNovo = valorNovo === 'vazio' ? 'Nenhuma' : valorNovo;
      valorAntigo = valorAntigo === 'vazio' ? 'Nenhuma' : valorAntigo;
      break;
    case 'senha':
      titulo = 'Senha foi redefinida';
      break;
    case 'nome_completo':
    case 'telefone':
    case 'email':
      Icon = User;
    // Deixa o 'default' cuidar do título
    default:
      // Usa o dicionário para pegar o nome amigável
      const nomeAmigavel = NOME_CAMPOS[evento.campo_alterado] || evento.campo_alterado;
      titulo = `${nomeAmigavel} foi atualizado`;
  }
  // --- FIM DA LÓGICA DO TÍTULO ---

  return (
    <>
      <div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-500 ring-8 ring-white">
          <Icon className="h-5 w-5 text-white" aria-hidden="true" />
        </span>
      </div>
      <div className="min-w-0 flex-1 justify-between space-x-4 pt-1.5">
        <div>
          <p className="text-sm text-gray-500">
            Atualização de Perfil em <time dateTime={evento.data_evento}>{formatarData(evento.data_evento)}</time>
          </p>
          <p className="mt-0.5 text-sm font-medium text-gray-900">{titulo}</p>

          {evento.campo_alterado !== 'senha' && (
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
              <span className="line-through">{valorAntigo}</span>
              <ArrowRight size={12} className="text-green-600" />
              <span className="font-semibold text-gray-700">{valorNovo}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


export default function HistoricoPublicador({ publicadorId }) {
  const [historico, setHistorico] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!publicadorId) return;

    const fetchHistorico = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/get-historico/${publicadorId}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Falha ao buscar histórico');
        }
        const data = await res.json();
        setHistorico(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistorico();
  }, [publicadorId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 p-4 rounded-md bg-red-900/30 text-red-300 border border-red-800">
        <p className="font-medium">Erro:</p>
        <p>{error}</p>
      </div>
    );
  }

  if (historico.length === 0) {
    return (
      <div className="mt-6 py-10 text-center text-neutral-500">
        <p>Nenhum histórico encontrado para este publicador.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flow-root">
        <ul role="list" className="-mb-8">
          {historico.map((evento, eventoIdx) => (
            <li key={evento.id + evento.tipo_evento}>
              <div className="relative pb-8">
                {eventoIdx !== historico.length - 1 ? (
                  <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-neutral-700" aria-hidden="true" />
                ) : null}

                <div className="relative flex space-x-3">
                  {evento.tipo_evento === 'designacao' ? (
                    <EventoDesignacao evento={evento} />
                  ) : (
                    <EventoPessoal evento={evento} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}