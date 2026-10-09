import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { normalizeDate, normalizeName, personalData, CADASTRO_FIELDS } from '@/app/lib/cadastro-update';
import { cadastroPool, ensureCadastroTables, limitCadastroAttempts, tokenHash } from '@/app/lib/cadastro-update-server';
export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request) {
  let body, date, terms;
  try {
    body = await request.json();
    if (typeof body.nome !== 'string' || body.nome.length > 200 || typeof body.nascimento !== 'string') throw new Error();
    terms = normalizeName(body.nome).split(/\s+/).filter(term => term.length > 1);
    date = normalizeDate(body.nascimento);
    if (!date || !terms.length) throw new Error();
  } catch { return reply({ message: 'Informe o nome e uma data de nascimento válida.' }, 400); }
  const client = await cadastroPool.connect();
  try {
    await ensureCadastroTables(client);
    if (!await limitCadastroAttempts(client, request, 'buscar')) return reply({ message: 'Muitas tentativas. Aguarde 15 minutos para tentar novamente.' }, 429);
    const dmy = date.split('-').reverse().join('/');
    const result = await client.query(`SELECT p.id, ${CADASTRO_FIELDS.map(([key]) => `p.${key}`).join(', ')}
      FROM publicadores p LEFT JOIN grupos g ON g.id = p.grupo_id
      WHERE (p.data_nascimento::text = $1 OR p.data_nascimento::text = $2) AND (g.id IS NULL OR g.ativo = TRUE)`, [date, dmy]);
    const matches = result.rows.filter(row => terms.every(term => normalizeName(`${row.nome_completo} ${row.nome_chamado || ''}`).includes(term)));
    if (matches.length !== 1) return reply({ message: matches.length > 1 ? 'Digite um nome mais completo para localizar seu cadastro.' : 'Cadastro não encontrado. Confira o nome e nascimento. Se a data cadastrada estiver incorreta, procure o responsável pelo cadastro.' }, 404);
    const data = personalData(matches[0]);
    const token = randomBytes(32).toString('hex');
    await client.query(`DELETE FROM cadastro_sessoes WHERE expires_at < NOW()`);
    await client.query(`INSERT INTO cadastro_sessoes (token_hash, publicador_id, snapshot, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '30 minutes')`, [tokenHash(token), matches[0].id, JSON.stringify(data)]);
    return reply({ dados: data, token });
  } catch (error) { console.error('Busca cadastral:', error); return reply({ message: 'Não foi possível consultar o cadastro. Tente novamente.' }, 500); }
  finally { client.release(); }
}
