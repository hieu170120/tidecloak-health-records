import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
const allowed = new Set(['GET me', 'GET me/emergency-capsule', 'PUT me/emergency-capsule', 'DELETE me/emergency-capsule', 'GET me/audit'])
async function forward(request:NextRequest,context:{params:Promise<{path:string[]}>}) {
  const path=(await context.params).path.join('/')
  if (!allowed.has(`${request.method} ${path}`)) return Response.json({error:'Not found'},{status:404})
  const authorization=request.headers.get('authorization')
  if (!authorization) return Response.json({error:'Authentication required'},{status:401})
  const headers=new Headers({'authorization':authorization,'content-type':'application/json'})
  const proof=request.headers.get('dpop');if(proof) headers.set('dpop',proof)
  try {
    const body=['PUT','DELETE'].includes(request.method) ? await request.text():undefined
    if (body && Buffer.byteLength(body)>400*1024) return Response.json({error:'Payload too large'},{status:413})
    const url=new URL(path,(process.env.HEALTH_API_URL ?? 'http://127.0.0.1:3001').replace(/\/$/,'')+'/')
    const upstream=await fetch(url,{method:request.method,headers,body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)})
    return new Response(await upstream.text(),{status:upstream.status,headers:{'content-type':'application/json','cache-control':'no-store'}})
  } catch {return Response.json({error:'Health API unavailable'},{status:502})}
}
export const GET=forward
export const PUT=forward
export const DELETE=forward
