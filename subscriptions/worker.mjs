import panel from './panel.mjs';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' };
const json = (body, status = 200) => Response.json(body, { status, headers });
export async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
const base64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
export function publicState(row, now = Date.now()) {
  const expired = row.expires_at && Date.parse(row.expires_at) <= now;
  const status = row.status === 'blocked' ? 'blocked' : expired ? 'expired' : 'active';
  return { customerId: row.id, customerName: row.name, status, reason: row.reason,
    expiresAt: row.expires_at, issuedAt: new Date(now).toISOString(),
    validUntil: new Date(Math.min(now + 86400000, row.expires_at ? Date.parse(row.expires_at) : Infinity)).toISOString(),
    supportUrl: 'https://www.nexareis.com.br/', supportPhone: '(11) 93710-5501' };
}
async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Informe os dados.');
  let length = 0; const chunks = [];
  try { while (true) { const {done, value} = await reader.read(); if (done) break;
    length += value.length; if (length > 8192) throw new Error('Dados muito grandes.'); chunks.push(value); }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function adminAuthorized(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Basic ') || !env.ADMIN_PASSWORD_HASH) return false;
  try { const [user, ...password] = atob(auth.slice(6)).split(':');
    return user === 'admin' && await hash(password.join(':')) === env.ADMIN_PASSWORD_HASH;
  } catch { return false; }
}
async function handle(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/license' && request.method === 'POST') {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (!token || token.length > 256) return json({ error: 'Chave inválida.' }, 401);
    const body = await readBody(request);
    const row = await env.DB.prepare('SELECT * FROM customers WHERE id=? AND token_hash=?').bind(body.customerId || '', await hash(token)).first();
    if (!row) return json({ error: 'Chave inválida.' }, 401);
    await env.DB.prepare('UPDATE customers SET last_seen_at=? WHERE id=?').bind(new Date().toISOString(), row.id).run();
    const payload = JSON.stringify(publicState(row));
    const pkcs8 = Uint8Array.from(atob(env.LICENSE_SIGNING_KEY), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('pkcs8', pkcs8, {name:'Ed25519'}, false, ['sign']);
    const signature = base64(await crypto.subtle.sign('Ed25519', key, new TextEncoder().encode(payload)));
    return json({ payload, signature });
  }
  if (!await adminAuthorized(request, env)) return new Response('Acesso restrito ao proprietário. Entre com o usuário admin e sua senha de gestão.', {
    status: 401, headers: {...headers, 'WWW-Authenticate':'Basic realm="Assinaturas NexaReis", charset="UTF-8"'} });
  if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) return json({error:'Origem inválida.'},403);
  if (url.pathname === '/' && request.method === 'GET') return new Response(panel, {headers:{...headers,'Content-Type':'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
  if (url.pathname === '/panel.js' && request.method === 'GET') return new Response(PANEL_SCRIPT,{headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
  if (url.pathname === '/api/customers' && request.method === 'GET') {
    const {results} = await env.DB.prepare('SELECT id,name,status,expires_at,reason,updated_at,last_seen_at FROM customers ORDER BY name LIMIT 500').all();
    return json(results.map(row=>({...row,effectiveStatus:publicState(row).status})));
  }
  if (url.pathname === '/api/customers' && request.method === 'POST') {
    const body = await readBody(request); const name = String(body.name || '').trim();
    if (!name || name.length > 120) return json({error:'Informe um nome de até 120 caracteres.'},400);
    const id = crypto.randomUUID(); const token = base64(crypto.getRandomValues(new Uint8Array(32)));
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO customers(id,name,token_hash,status,reason,updated_at) VALUES(?,?,?,?,?,?)').bind(id,name,await hash(token),'blocked','Aguardando ativação',now),
      env.DB.prepare('INSERT INTO audit(customer_id,action,created_at) VALUES(?,?,?)').bind(id,'Cliente cadastrado bloqueado',now)
    ]);
    return json({id,name,activationKey:token},201);
  }
  const match = url.pathname.match(/^\/api\/customers\/([a-zA-Z0-9-]+)(?:\/(history|rotate-key))?$/);
  if (!match) return json({error:'Página não encontrada.'},404);
  const row = await env.DB.prepare('SELECT * FROM customers WHERE id=?').bind(match[1]).first();
  if (!row) return json({error:'Cliente não encontrado.'},404);
  if (match[2] === 'history' && request.method === 'GET') {
    return json((await env.DB.prepare('SELECT action,created_at FROM audit WHERE customer_id=? ORDER BY id DESC LIMIT 100').bind(row.id).all()).results);
  }
  if (match[2] === 'rotate-key' && request.method === 'POST') {
    const token = base64(crypto.getRandomValues(new Uint8Array(32))); const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('UPDATE customers SET token_hash=?,updated_at=? WHERE id=?').bind(await hash(token),now,row.id),
      env.DB.prepare('INSERT INTO audit(customer_id,action,created_at) VALUES(?,?,?)').bind(row.id,'Nova chave emitida; anterior invalidada',now)
    ]); return json({customerId:row.id,activationKey:token});
  }
  if (!match[2] && request.method === 'PATCH') {
    const body = await readBody(request);
    if (!['active','blocked'].includes(body.status)) return json({error:'Status inválido.'},400);
    const reason = String(body.reason || '').trim(); if (reason.length > 300) return json({error:'Motivo muito longo.'},400);
    const expires = body.expiresAt || null;
    if (expires && (!Number.isFinite(Date.parse(expires)) || (body.status === 'active' && Date.parse(expires) <= Date.now()))) return json({error:'Escolha um vencimento futuro.'},400);
    const normalizedExpires = expires ? new Date(expires).toISOString() : null; const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('UPDATE customers SET status=?,expires_at=?,reason=?,updated_at=? WHERE id=?').bind(body.status,normalizedExpires,reason,now,row.id),
      env.DB.prepare('INSERT INTO audit(customer_id,action,created_at) VALUES(?,?,?)').bind(row.id,`${body.status === 'active' ? 'Liberado' : 'Bloqueado'} | Vencimento: ${normalizedExpires || 'sem data'} | ${reason}`,now)
    ]); return json({success:true});
  }
  return json({error:'Método não permitido.'},405);
}
export default { async fetch(request, env) {
  try { return await handle(request,env); }
  catch (error) { console.error(JSON.stringify({event:'subscription-error',message:error.message})); return json({error:'Não foi possível concluir. Tente novamente.'},500); }
}};

const PANEL_SCRIPT = `
const list=document.getElementById('customers'), notice=document.getElementById('notice');
const labels={active:'Ativa',blocked:'Bloqueada',expired:'Vencida'};
const selectedCustomer=new URL(location.href).searchParams.get('customer');
async function api(path,options={}){const r=await fetch(path,{...options,headers:{'Content-Type':'application/json'},cache:'no-store'});if(!r.ok){let e;try{e=await r.json()}catch{}throw Error(e?.error||'Falha no acesso. Atualize e tente novamente.')}return r.json()}
function tell(text){notice.textContent=text}
function el(tag,text){const node=document.createElement(tag);node.textContent=text;return node}
function field(label,node){const wrap=el('label',label);wrap.append(node);return wrap}
async function load(){try{list.replaceChildren();const allRows=await api('/api/customers');const rows=selectedCustomer?allRows.filter(row=>row.id===selectedCustomer):allRows;if(!rows.length)list.append(el('p',selectedCustomer?'Instalação não encontrada. Confira o QR code com o suporte.':'Nenhum cliente cadastrado.'));for(const row of rows){
const section=el('section',''), heading=el('h2',row.name), state=el('span',labels[row.effectiveStatus]);state.className='status '+row.effectiveStatus;heading.append(state);section.append(heading,el('p','Identificação: '+row.id),el('p','Última conexão: '+(row.last_seen_at?new Date(row.last_seen_at).toLocaleString('pt-BR'):'Aguardando conexão')));
const form=el('form',''), select=el('select','');for(const [value,label] of [['blocked','Bloqueada'],['active','Ativa']]){const option=el('option',label);option.value=value;select.append(option)}select.value=row.status;
const expiry=el('input','');expiry.type='datetime-local';if(row.expires_at){const d=new Date(row.expires_at);expiry.value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
const reason=el('input','');reason.value=row.reason;reason.maxLength=300;const save=el('button','Salvar assinatura');save.type='submit';
form.append(field('Situação',select),field('Vencimento (se vazio, sem prazo)',expiry),field('Motivo',reason),save);form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await api('/api/customers/'+row.id,{method:'PATCH',body:JSON.stringify({status:select.value,expiresAt:expiry.value?new Date(expiry.value).toISOString():null,reason:reason.value})});tell('Assinatura salva. A loja receberá a alteração em até 30 segundos quando estiver online.');await load()}catch(err){tell(err.message)}finally{save.disabled=false}};
const history=el('button','Ver histórico');history.type='button';history.className='secondary';const entries=el('div','');history.onclick=async()=>{try{entries.replaceChildren();for(const item of await api('/api/customers/'+row.id+'/history'))entries.append(el('p',new Date(item.created_at).toLocaleString('pt-BR')+' — '+item.action))}catch(err){tell(err.message)}};
const rotate=el('button','Emitir nova chave');rotate.type='button';rotate.className='secondary';rotate.onclick=async()=>{if(!confirm('Emitir uma nova chave para '+row.name+'? A chave anterior deixará de funcionar.'))return;rotate.disabled=true;try{const result=await api('/api/customers/'+row.id+'/rotate-key',{method:'POST',body:'{}'});showKey(result.customerId,result.activationKey)}catch(err){tell(err.message)}finally{rotate.disabled=false}};
if(selectedCustomer && row.effectiveStatus!=='active'){const unlock=el('button','Desbloquear este telão');unlock.type='button';unlock.onclick=async()=>{unlock.disabled=true;try{await api('/api/customers/'+row.id,{method:'PATCH',body:JSON.stringify({status:'active',expiresAt:expiry.value?new Date(expiry.value).toISOString():null,reason:'Liberação pelo painel de assinaturas'})});tell('Telão liberado. Aguarde até 35 segundos para atualizar.');await load()}catch(err){tell(err.message)}finally{unlock.disabled=false}};section.append(unlock)}
section.append(form,history,rotate,entries);list.append(section)}}catch(err){tell(err.message)}}
function showKey(id,key){const box=document.getElementById('keybox');box.hidden=false;document.getElementById('activation').value='Cliente: '+id+'\\nChave: '+key;tell('Guarde a chave. Ela é exibida apenas nesta emissão. Configure-a somente no servidor da loja.');box.scrollIntoView({behavior:'smooth',block:'nearest'})}
document.getElementById('create').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const result=await api('/api/customers',{method:'POST',body:JSON.stringify({name:document.getElementById('name').value})});await load();showKey(result.id,result.activationKey);e.target.reset()}catch(err){tell(err.message)}finally{button.disabled=false}};
document.getElementById('refresh').onclick=load;document.getElementById('hidekey').onclick=()=>{document.getElementById('activation').value='';document.getElementById('keybox').hidden=true};load();
`;
