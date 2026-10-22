const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {spawn}=require('node:child_process');
const {createHash,randomBytes,randomUUID,verify}=require('node:crypto');
const {Pool}=require('pg');
const {generateKeyPair,exportJWK,SignJWT,calculateJwkThumbprint}=require('jose');
const {DatabaseService}=require('./dist/database/database.service');
const {PrincipalsService}=require('./dist/principals/principals.service');
const {CapsulesService}=require('./dist/capsules/capsules.service');
const {AuditService}=require('./dist/audit/audit.service');

(async()=>{
 assert.match(process.env.TEST_DATABASE_NAME ?? '',/^health_it_[a-z0-9_]+$/);
 assert.equal(process.env.POSTGRES_PASSWORD,undefined,'API must not receive DB owner password');
 assert.equal(process.env.AUDIT_DB_PASSWORD,undefined,'API must not receive audit_writer password');
 process.env.DATABASE_NAME=process.env.TEST_DATABASE_NAME;
 const pool=new Pool({host:process.env.DATABASE_HOST,port:Number(process.env.DATABASE_PORT),user:process.env.DATABASE_USER,
   password:process.env.DATABASE_PASSWORD,database:process.env.DATABASE_NAME});
 const key=await generateKeyPair('ES256');const jwk=await exportJWK(key.publicKey);jwk.kid='test-signing';jwk.alg='ES256';
 const jwksServer=createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({keys:[jwk]}));});
 await new Promise(r=>jwksServer.listen(0,'127.0.0.1',r));
 const issuer=`http://127.0.0.1:${jwksServer.address().port}/issuer`;
 const base='http://127.0.0.1:3101';
 let child;const log=[];let db;
 const results=[];
 async function test(name,fn){await fn();results.push(name);console.log('PASS',name);}
 async function token(sub,roles=['PATIENT'],extra={},opts={}) {
   let jwt=new SignJWT({realm_access:{roles},...extra}).setProtectedHeader({alg:'ES256',kid:'test-signing'}).setSubject(sub).setIssuer(opts.issuer??issuer).setAudience(opts.aud??'health-test').setIssuedAt();
   if(!opts.noExpiry)jwt=jwt.setExpirationTime(opts.expired?Math.floor(Date.now()/1000)-120:'5m');
   return jwt.sign(key.privateKey);
 }
 async function req(path,access,method='GET',body,more={}) {
   const response=await fetch(base+path,{method,headers:{...(access?{authorization:'Bearer '+access}:{}),'content-type':'application/json',...more},body:body===undefined?undefined:JSON.stringify(body)});
   return {status:response.status,data:await response.json()};
 }
 function envelope(expectedVersion){return {expectedVersion,ciphertext:randomBytes(64).toString('base64'),ciphertextFormat:'TIDE_BYTES'};}
 try {
  child=spawn(process.execPath,['dist/main.js'],{env:{...process.env,PORT:'3101',TIDECLOAK_ISSUER_URL:issuer,TIDECLOAK_JWKS_URL:issuer+'/keys',TIDECLOAK_AUDIENCE:'health-test',TIDECLOAK_CLIENT_ID:'health-test',DPOP_PUBLIC_BASE_URL:base},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',x=>log.push(x.toString()));child.stderr.on('data',x=>log.push(x.toString()));
  let ready=false;
  for(let i=0;i<80;i++){try{ready=(await fetch(base+'/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  assert(ready,'Test API did not start: '+log.join('').slice(-1500));
  const alice=await token('integration-alice');const bob=await token('integration-bob');const doctor=await token('integration-doctor',['DOCTOR']);
  await test('missing, expired, wrong issuer/audience, no-exp tokens rejected',async()=>{
   assert.equal((await req('/me')).status,401);
   for(const options of [{expired:true},{issuer:'https://wrong.invalid'},{aud:'wrong'},{noExpiry:true}])assert.equal((await req('/me',await token('bad',['PATIENT'],{},options))).status,401);
  });
  let aliceId,bobId;
  await test('identity mapping is idempotent and roles remain token-derived',async()=>{
   const first=await req('/me',alice);assert.equal(first.status,200);aliceId=first.data.principalId;
   assert.equal((await req('/me',alice)).data.principalId,aliceId);
   bobId=(await req('/me',bob)).data.principalId;
   assert.notEqual(aliceId,bobId);
   assert.deepEqual(first.data.roles,['PATIENT']);
  });
  await test('doctor and role-less user cannot access patient capsule',async()=>{
   assert.equal((await req('/me/emergency-capsule',doctor)).status,403);
   assert.equal((await req('/me/emergency-capsule',await token('none',[]))).status,403);
  });
  let expected=envelope(0);
  await test('opaque ciphertext create/read roundtrip and patient isolation',async()=>{
   const saved=await req('/me/emergency-capsule',alice,'PUT',expected);assert.equal(saved.status,200);assert.equal(saved.data.version,1);
   const read=await req('/me/emergency-capsule',alice);assert.equal(read.data.capsule.ciphertext,expected.ciphertext);
   const other=await req('/me/emergency-capsule?patientId='+aliceId,bob);assert.equal(other.data.capsule,null);
   assert.equal((await req('/me/emergency-capsule',alice,'PUT',{...envelope(1),patientId:bobId})).status,400);
  });
  await test('plaintext, malformed ciphertext and oversized envelopes rejected',async()=>{
   for(const body of [{expectedVersion:1,bloodType:'synthetic'}, {...envelope(1),ciphertext:'%%%invalid'},envelope(-1)])
     assert.equal((await req('/me/emergency-capsule',alice,'PUT',body)).status,400);
   const huge=await req('/me/emergency-capsule',alice,'PUT',{...envelope(1),ciphertext:'A'.repeat(500000)});assert.equal(huge.status,413);
  });
  await test('concurrent saves produce one new version and a 409 for the stale tab',async()=>{
   const outcomes=await Promise.all([req('/me/emergency-capsule',alice,'PUT',envelope(1)),req('/me/emergency-capsule',alice,'PUT',envelope(1))]);
   assert.deepEqual(outcomes.map(x=>x.status).sort(),[200,409]);
   const counts=await pool.query("SELECT count(*)::int AS n FROM health.emergency_capsules WHERE patient_id=$1 AND status='ACTIVE'",[aliceId]);assert.equal(counts.rows[0].n,1);
   assert.equal((await req('/me/emergency-capsule',alice)).data.latestVersion,2);
  });
  await test('archive retains history; replacement uses increasing version',async()=>{
   assert.equal((await req('/me/emergency-capsule',alice,'DELETE',{expectedVersion:2})).status,200);
   const read=await req('/me/emergency-capsule',alice);assert.equal(read.data.capsule,null);assert.equal(read.data.latestVersion,2);
   assert.equal((await req('/me/emergency-capsule',alice,'PUT',envelope(2))).data.version,3);
  });
  await test('audit failure rolls back capsule replacement and preserves current version',async()=>{
   db=new DatabaseService();const audit=new AuditService();const principals=new PrincipalsService(audit);
   const failing={append:async()=>{throw Error('test audit failure');}};
   const capsules=new CapsulesService(db,principals,failing);
   await assert.rejects(()=>capsules.save({subject:'integration-alice',roles:['PATIENT']},envelope(3)),/test audit failure/);
   const r=await pool.query("SELECT version,status FROM health.emergency_capsules WHERE patient_id=$1 ORDER BY version",[aliceId]);
   assert.equal(r.rows.length,3);assert.equal(r.rows.at(-1).version,3);assert.equal(r.rows.at(-1).status,'ACTIVE');
  });
  await test('suspended principals denied without reactivation',async()=>{
   await pool.query("UPDATE health.principals SET status='SUSPENDED' WHERE id=$1",[aliceId]);
   assert.equal((await req('/me',alice)).status,403);
   await pool.query("UPDATE health.principals SET status='ACTIVE' WHERE id=$1",[aliceId]);
  });
  await test('audit is owner-filtered, signed and direct table mutation is denied',async()=>{
   const a=(await req('/me/audit',alice)).data;
   assert(a.events.length>0);assert(a.events.every(x=>x.event.patientId===aliceId&&x.signatureValid));
   assert(a.events.some(x=>x.event.action==='EMERGENCY_CAPSULE_WRITE_REJECTED'));
   for(const x of a.events){const canonical=JSON.stringify(Object.fromEntries(Object.entries(x.event).sort(([a],[b])=>a<b?-1:a>b?1:0)));
    assert(verify(null,Buffer.from(canonical),a.publicKeyPem,Buffer.from(x.signature,'base64')));assert.equal(createHash('sha256').update(canonical).digest('hex'),x.hash);}
   await assert.rejects(()=>pool.query('UPDATE health.audit_events SET action=action'),e=>e.code==='42501');
   await assert.rejects(()=>pool.query('SELECT * FROM health.audit_events'),e=>e.code==='42501');
  });
  const dpopKey=await generateKeyPair('ES256');const publicJwk=await exportJWK(dpopKey.publicKey);const jkt=await calculateJwkThumbprint(publicJwk);
  const bound=await token('integration-alice',['PATIENT'],{cnf:{jkt}});
  async function proof(overrides={},keyPair=dpopKey,jwkOverride=publicJwk){return new SignJWT({jti:randomUUID(),iat:Math.floor(Date.now()/1000),htm:'GET',htu:base+'/me',ath:createHash('sha256').update(bound).digest('base64url'),...overrides}).setProtectedHeader({typ:'dpop+jwt',alg:'ES256',jwk:jwkOverride}).sign(keyPair.privateKey);}
  await test('DPoP valid proof accepted and replay/missing proof/Bearer downgrade rejected',async()=>{
   const p=await proof();const headers={authorization:'DPoP '+bound,dpop:p};
   assert.equal((await req('/me',undefined,'GET',undefined,headers)).status,200);
   assert.equal((await req('/me',undefined,'GET',undefined,headers)).status,401);
   assert.equal((await req('/me',bound)).status,401);
   assert.equal((await req('/me',undefined,'GET',undefined,{authorization:'DPoP '+bound})).status,401);
  });
  await test('DPoP wrong method/URL/token hash/freshness/key rejected',async()=>{
   for(const changes of [{htm:'POST'},{htu:base+'/other'},{ath:'wrong'},{iat:Math.floor(Date.now()/1000)+300}]){
    assert.equal((await req('/me',undefined,'GET',undefined,{authorization:'DPoP '+bound,dpop:await proof(changes)})).status,401);
   }
   const wrong=await generateKeyPair('ES256');assert.equal((await req('/me',undefined,'GET',undefined,{authorization:'DPoP '+bound,dpop:await proof({},wrong,await exportJWK(wrong.publicKey))})).status,401);
  });
  await test('concurrent independent identities append audit without forks',async()=>{
   const tokens=await Promise.all(Array.from({length:8},(_,i)=>token('integration-parallel-'+i)));
   const identities=await Promise.all(tokens.map(t=>req('/me',t)));
   assert(identities.every(x=>x.status===200));
   assert.equal(new Set(identities.map(x=>x.data.principalId)).size,8);
   const trails=await Promise.all(tokens.map(t=>req('/me/audit',t)));
   assert(trails.every(x=>x.data.events.length===1&&x.data.events[0].signatureValid));
  });
  console.log(JSON.stringify({passed:results.length,database:process.env.TEST_DATABASE_NAME,realTideLoginTested:false,realTideEncryptionTested:false}));
 } finally {
  if(child){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
  if(db)await db.onModuleDestroy();await pool.end();await new Promise(r=>jwksServer.close(r));
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
