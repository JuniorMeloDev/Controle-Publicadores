import { territoryBoundaryProposals } from './territory-boundary-proposal-data.js';

const sharedNorth = [-34.919161605508656, -8.208306058110622];
const sharedSouth = [-34.9196014877871, -8.210026320230128];

function proposalObservation(number) {
  let observation = 'Confira o contorno com as divisas e quadras do PDF. Os cartões usam nomes de ruas que podem diferir dos nomes atuais do mapa.';
  if ([2, 7, 8, 13, 14, 18, 19, 20].includes(number)) observation += ' José Nunes da Cunha e Presidente Kennedy precisam ser conferidas pela posição das quadras, além do nome exibido no mapa.';
  if (number === 23) observation += ' No trecho sul da divisa com o 22, o eixo da rua foi prolongado até o limite geral porque a base de ruas apresenta uma interrupção; confira esse trecho com atenção.';
  if (number === 28) observation += ' A divisa com Inocop acompanha o limite geral já cadastrado. Confira o recorte próximo aos territórios 24 e 27.';
  if ([19, 20].includes(number)) observation += ' Atenção: os cartões 19 e 20 indicam uma faixa em comum entre Presidente Kennedy e Maria Digna, ao sul da Travessa Candelária. A faixa não foi atribuída automaticamente. Ajuste essa divisa antes de validar.';
  return observation;
}

export function territoryBoundaryProposal(territory, territories) {
  const proposal = territoryBoundaryProposals[territory.numero];
  if (!proposal || !territory.ativo || territory.limites || territory.pdf_hash !== proposal.pdf_hash) return null;
  const neighbor = territories.find(t => t.numero === 1 && t.ativo);
  const ring = neighbor?.limites?.coordinates?.[0];
  // Do not offer a stale shared border after territory 1 has been adjusted.
  if (!ring?.some((point, index) => JSON.stringify(point) === JSON.stringify(sharedSouth)
    && JSON.stringify(ring[index + 1]) === JSON.stringify(sharedNorth))) return null;
  return {
    titulo: `Sugestão de demarcação do território ${territory.numero}`,
    divisas: [...proposal.divisas],
    observacao: proposalObservation(territory.numero),
    conflito_com: proposal.conflito_com || null,
    limites: structuredClone(proposal.limites)
  };
}
