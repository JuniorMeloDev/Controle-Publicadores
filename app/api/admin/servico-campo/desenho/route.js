import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/app/lib/request-authorization';
import { getUserIdFromRequest } from '@/app/lib/server-access';
import { registerAuditLog } from '@/app/lib/audit-log';
import { fieldId } from '@/app/lib/field-service';
import { readEditableTerritory,saveEditableTerritory } from '@/app/lib/editable-territory-server';
export const dynamic='force-dynamic';
const pool=new Pool({connectionString:process.env.POSTGRES_URL});
const failure=error=>NextResponse.json({message:error.code==='23505'?'Este número de território já está em uso.':error.status?error.message:'Não foi possível carregar ou salvar o desenho.'},{status:error.code==='23505'?409:error.status||500});
export async function GET(request){
  const denied=await authorizeRequest(request,'GET');if(denied)return denied;
  let id;try{id=fieldId(new URL(request.url).searchParams.get('territorio'));}catch{return NextResponse.json({message:'Território inválido.'},{status:400});}
  let client;try{client=await pool.connect();return NextResponse.json(await readEditableTerritory(client,id),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return failure(error);}finally{client?.release();}
}
export async function POST(request){
  const denied=await authorizeRequest(request,'POST');if(denied)return denied;
  let body;try{body=await request.json();if(!body||typeof body!=='object')throw new Error();}catch{return NextResponse.json({message:'Dados inválidos.'},{status:400});}
  let client,transaction=false;
  try{client=await pool.connect();await client.query('BEGIN');transaction=true;const result=await saveEditableTerritory(client,body);
    await registerAuditLog(client,{userId:getUserIdFromRequest(request),action:'campo_desenho_salvo',entity:'campo_territorio',entityId:result.id,details:{revisao:result.revisao,grupo_id:body.grupo_id,numero:body.numero}});
    await client.query('COMMIT');transaction=false;return NextResponse.json(result);
  }catch(error){if(transaction)await client.query('ROLLBACK');return failure(error);}finally{client?.release();}
}
