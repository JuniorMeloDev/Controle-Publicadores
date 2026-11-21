import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pool } from 'pg';
import { isPushId } from '@/app/lib/push-subscriptions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Aviso geral', robots: { index: false, follow: false } };
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export default async function GeneralNoticePage({ params }) {
  const { id } = await params;
  if (!isPushId(id)) notFound();
  const { rows: [notice] } = await pool.query('SELECT titulo, mensagem FROM web_push_avisos_gerais WHERE id = $1', [id]);
  if (!notice) notFound();
  return <main className="min-h-dvh bg-gray-50 p-6 text-gray-900 grid place-items-center">
    <article className="w-full max-w-xl space-y-4 rounded-xl border bg-white p-6 shadow-sm">
      <h1 className="break-words text-2xl font-semibold">{notice.titulo}</h1>
      <p className="whitespace-pre-wrap break-words text-gray-700">{notice.mensagem}</p>
      <Link href="/" className="inline-flex min-h-11 items-center text-purple-700 hover:underline">Abrir o site</Link>
    </article>
  </main>;
}
