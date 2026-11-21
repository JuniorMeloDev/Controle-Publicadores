import { Pool } from 'pg';
import { handleDevicePush } from '@/app/lib/device-push-api';
import { authorizeRequest } from '@/app/lib/request-authorization';
import { getUserIdFromRequest } from '@/app/lib/server-access';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function handle(request, method) {
  const denied = await authorizeRequest(request, method);
  if (denied) return denied;
  return handleDevicePush(request, method, { db: pool, userId: getUserIdFromRequest(request) });
}

export async function GET(request) { return handle(request, 'GET'); }
export async function PUT(request) { return handle(request, 'PUT'); }
export async function DELETE(request) { return handle(request, 'DELETE'); }
