// Verifica o ciclo remoto com a instalação atual e restaura o bloqueio ao terminar.
const fs=require('fs');const path=require('path');const assert=require('assert/strict');
const dotenv=require('../server/node_modules/dotenv');
const root=path.resolve(__dirname,'..');const d=JSON.parse(fs.readFileSync(path.join(root,'.secrets/subscription-deployment.json'),'utf8'));
const password=fs.readFileSync(path.join(root,'.secrets/acesso-assinaturas.txt'),'utf8').match(/^Senha: (.+)$/m)[1];
const env=dotenv.parse(fs.readFileSync(path.join(root,'server/.env'),'utf8'));
const remote='https://chamador-assinaturas.nicolas-santapaula.workers.dev';const local='http://localhost:3040';
const owner='Basic '+Buffer.from('admin:'+password).toString('base64');
const admin='Basic '+Buffer.from((env.ADMIN_USER||'admin')+':'+(env.ADMIN_PASSWORD||'123456')).toString('base64');
async function setRemote(status){const r=await fetch(remote+'/api/customers/'+d.customerId,{method:'PATCH',headers:{Authorization:owner,Origin:remote,'Content-Type':'application/json'},body:JSON.stringify({status,reason:status==='blocked'?'Bloqueio solicitado pelo proprietário':'Verificação de liberação remota'})});assert.equal(r.status,200,'Atualização remota');}
async function synchronize(){const r=await fetch(local+'/admin/activation',{method:'POST',headers:{Authorization:admin,Origin:local,'Content-Type':'application/json'},body:JSON.stringify({token:d.token})});assert.equal(r.status,200,'Sincronização local');return r.json();}
(async()=>{
 try{
  const denied=await fetch(remote+'/api/customers');assert.equal(denied.status,401);
  const panel=await fetch(remote+'/',{headers:{Authorization:owner}});assert.equal(panel.status,200);assert.ok((await panel.text()).includes('Cadastrar cliente'));
  const customers=await(await fetch(remote+'/api/customers',{headers:{Authorization:owner}})).json();assert.equal(customers.find(c=>c.id===d.customerId).status,'blocked');
  await setRemote('active');assert.equal((await synchronize()).allowed,true);
  const telao=await fetch(local+'/');assert.equal(telao.status,200);assert.ok((await telao.text()).includes('/subscription/guard.js'));
  console.log('Liberação remota confirmada; telão ativo e protegido pela validação.');
 }finally{await setRemote('blocked');assert.equal((await synchronize()).allowed,false);}
 const blocked=await(await fetch(local+'/')).text();assert.ok(blocked.includes('Sistema bloqueado'));assert.ok(blocked.includes('93710-5501'));
 for(const route of ['/api/chamar','/api/call']){const r=await fetch(local+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({caixa:'teste-bloqueado'})});assert.equal(r.status,423);}
 const response=await fetch(local+'/admin/activation',{method:'POST',headers:{Authorization:admin,Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify({token:d.token})});assert.equal(response.status,403);
 console.log('Bloqueio restaurado. HTTP atual e legado bloqueados; painel exige acesso e ativação recusa origem externa.');
})().catch(error=>{console.error(error.message);process.exitCode=1});
