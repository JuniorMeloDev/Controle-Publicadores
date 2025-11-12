import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Rota: GET /api/get-cep/[cep]
export async function GET(request, context) {
  const { cep } = await context.params; // ✅ Agora aguardamos o Promise

  if (!cep || cep.length < 8) {
    return NextResponse.json({ message: 'CEP inválido' }, { status: 400 });
  }

  const cepLimpo = cep.replace(/\D/g, '');

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Falha ao buscar CEP na API externa.');
    }

    const data = await response.json();

    if (data.erro) {
      return NextResponse.json({ message: 'CEP não encontrado.' }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error('Erro na API de CEP:', err);
    return NextResponse.json({ message: 'Erro interno ao buscar CEP.' }, { status: 500 });
  }
}
