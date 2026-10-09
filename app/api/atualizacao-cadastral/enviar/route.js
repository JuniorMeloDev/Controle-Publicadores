import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { personalData, validatePersonalData, planChanges } from '@/app/lib/cadastro-update';
import { cadastroPool, ensureCadastroTables, limitCadastroAttempts, tokenHash, applyCadastroField } from '@/app/lib/cadastro-update-server';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  let body, incoming;
  try {
    body = await request.json();
    if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) throw new Error('Busque seu cadastro novamente.');
    incoming = validatePersonalData(body.dados);
  } catch (error) { return NextResponse.json({ message: error.message || 'Dados inválidos.' }, { status: 400 }); }
  const client = await cadastroPool.connect();
  try {
    await ensureCadastroTables(client);
    if (!await limitCadastroAttempts(client, request, 'enviar')) return NextResponse.json({ message: 'Muitas tentativas. Aguarde 15 minutos.' }, { status: 429 });
    await client.query('BEGIN');
    const session = await client.query(`SELECT * FROM cadastro_sessoes WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL FOR UPDATE`, [tokenHash(body.token)]);
    if (!session.rows.length) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: 'Sua sessão expirou ou já foi enviada. Busque o cadastro novamente.' }, { status: 401 });
    }
    const { publicador_id: id, snapshot } = session.rows[0];
    const publisher = await client.query('SELECT * FROM publicadores WHERE id = $1 FOR UPDATE', [id]);
    const changes = planChanges(personalData(publisher.rows[0]), incoming, snapshot);
    const envioId = randomUUID();
    for (const change of [...changes.automatic, ...changes.pending]) {
      const automatic = !change.old;
      await client.query(`INSERT INTO cadastro_alteracoes (envio_id, publicador_id, campo, valor_antigo, valor_novo, status)
        VALUES ($1, $2, $3, $4, $5, $6)`, [envioId, id, change.field, change.old || null, change.value, automatic ? 'automatico' : 'pendente']);
      if (automatic) await applyCadastroField(client, id, change.field, change.old, change.value);
    }
    await client.query('UPDATE cadastro_sessoes SET used_at = NOW() WHERE token_hash = $1', [tokenHash(body.token)]);
    await client.query('COMMIT');
    return NextResponse.json({ automaticos: changes.automatic.length, pendentes: changes.pending.length });
  } catch (error) {
    await client.query('ROLLBACK'); console.error('Envio cadastral:', error);
    return NextResponse.json({ message: 'Não foi possível enviar. Nenhuma alteração deste envio foi aplicada. Tente novamente.' }, { status: 500 });
  } finally { client.release(); }
}
