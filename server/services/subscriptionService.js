const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { managementUrl } = require('./subscriptionQr');

class SubscriptionService extends EventEmitter {
  constructor({ env = process.env, dataDir = path.join(__dirname, '..', 'data'), fetchImpl = fetch, now = Date.now, logger = console } = {}) {
    super(); this.env = env; this.fetchImpl = fetchImpl; this.now = now; this.logger = logger;
    this.enabled = env.SUBSCRIPTION_ENABLED === 'true'; this.grant = null; this.timer = null; this.inFlight = null;
    this.cachePath = path.join(dataDir, 'subscription-cache.json');
    this.state = this.enabled ? {status:'pending',customerId:env.SUBSCRIPTION_CUSTOMER_ID || ''} : {status:'active',managed:false};
    if (this.enabled) { try { this.accept(JSON.parse(fs.readFileSync(this.cachePath,'utf8')), false); } catch (_) {} }
  }
  verify(envelope) {
    if (!envelope || typeof envelope.payload !== 'string' || envelope.payload.length > 8192 || typeof envelope.signature !== 'string') throw Error('Resposta de licença inválida');
    const key = crypto.createPublicKey({key:Buffer.from(this.env.SUBSCRIPTION_PUBLIC_KEY || '', 'base64'),format:'der',type:'spki'});
    if (!crypto.verify(null,Buffer.from(envelope.payload),key,Buffer.from(envelope.signature,'base64'))) throw Error('Assinatura da licença inválida');
    const state = JSON.parse(envelope.payload);
    if (state.customerId !== this.env.SUBSCRIPTION_CUSTOMER_ID || !['active','blocked','expired'].includes(state.status)) throw Error('Licença de outro cliente ou status inválido');
    const issued = Date.parse(state.issuedAt), until = Date.parse(state.validUntil);
    if (!Number.isFinite(issued) || !Number.isFinite(until) || issued > this.now() + 300000 || until > issued + 86400000) throw Error('Prazo da licença inválido');
    return state;
  }
  accept(envelope, persist = true) {
    const state = this.verify(envelope);
    if (this.grant && Date.parse(state.issuedAt) < Date.parse(this.grant.issuedAt)) throw Error('Resposta de licença anterior ao estado já confirmado');
    this.grant = state;
    if (persist) { const temp=this.cachePath+'.tmp';fs.writeFileSync(temp,JSON.stringify(envelope));fs.renameSync(temp,this.cachePath); }
    this.updateState(state);
  }
  updateState(state) {
    const previous = JSON.stringify(this.publicStatus()); this.state = state;
    const current = this.publicStatus(); if (previous !== JSON.stringify(current)) this.emit('change',current);
  }
  publicStatus() {
    let status=this.state.status;
    if (this.enabled && status === 'active') {
      if (this.state.expiresAt && Date.parse(this.state.expiresAt) <= this.now()) status='expired';
      else if (this.now() >= Date.parse(this.state.validUntil) || this.now() < Date.parse(this.state.issuedAt)-300000) status='unverified';
    }
    return {managed:this.enabled,allowed:status === 'active',status,customerId:this.state.customerId || '',customerName:this.state.customerName || '',
      expiresAt:this.state.expiresAt || null,validUntil:this.state.validUntil || null,
      supportUrl:'https://www.nexareis.com.br/',supportPhone:'(11) 93710-5501'};
  }
  managementUrl() {
    return managementUrl(this.env);
  }
  isAllowed() { return this.publicStatus().allowed; }
  async refresh() {
    if (!this.enabled) return;
    if (this.inFlight) return this.inFlight;
    this.inFlight=this.check().finally(()=>{this.inFlight=null;});return this.inFlight;
  }
  async retrieve(token = this.env.SUBSCRIPTION_TOKEN) {
      const url = new URL(this.env.SUBSCRIPTION_URL);
      if (url.protocol !== 'https:') throw Error('Validação exige HTTPS');
      const response = await this.fetchImpl(url.href.replace(/\/$/,'')+'/api/license',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({customerId:this.env.SUBSCRIPTION_CUSTOMER_ID}),signal:AbortSignal.timeout(8000),redirect:'error'
      });
      if (response.status === 401 || response.status === 403) {
        const error=new Error('Chave de ativação inválida ou revogada');error.revoked=true;throw error;
      }
      if (!response.ok) throw Error('Central indisponível: '+response.status);
      const length=Number(response.headers.get('content-length')||0);if(length>16384)throw Error('Resposta muito grande');
      const reader=response.body.getReader();let size=0;const chunks=[];
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384)throw Error('Resposta muito grande');chunks.push(Buffer.from(value));}}
      finally{await reader.cancel();}
      const envelope=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      this.verify(envelope);return envelope;
  }
  async activate(token, envPath) {
    if (!this.enabled) throw Error('Esta instalação ainda não está vinculada à central.');
    if (typeof token !== 'string' || !token.trim() || token.length > 256 || /[\r\n]/.test(token)) throw Error('Chave inválida.');
    token=token.trim();
    const envelope=await this.retrieve(token);
    let content=fs.readFileSync(envPath,'utf8');
    const line='SUBSCRIPTION_TOKEN='+token;
    content=/^SUBSCRIPTION_TOKEN=.*$/m.test(content)?content.replace(/^SUBSCRIPTION_TOKEN=.*$/m,line):content+'\n'+line+'\n';
    fs.writeFileSync(envPath+'.tmp',content);fs.renameSync(envPath+'.tmp',envPath);
    this.env.SUBSCRIPTION_TOKEN=token;this.accept(envelope);
    return this.publicStatus();
  }
  async check() {
    const token = this.env.SUBSCRIPTION_TOKEN;
    try {
      const envelope = await this.retrieve(token);
      if (token !== this.env.SUBSCRIPTION_TOKEN) return;
      this.accept(envelope);
    } catch (error) {
      if (token !== this.env.SUBSCRIPTION_TOKEN) return;
      if (error.revoked) {
        this.grant=null;try{fs.unlinkSync(this.cachePath);}catch(_){}
        this.updateState({status:'invalid',customerId:this.env.SUBSCRIPTION_CUSTOMER_ID});return;
      }
      this.logger.warn('[Assinatura] Validação indisponível:',error.message);
      this.updateState(this.grant || {status:'pending',customerId:this.env.SUBSCRIPTION_CUSTOMER_ID});
    }
  }
  start() { if(this.enabled) { this.timer=setInterval(()=>{void this.refresh();},30000);this.timer.unref(); } }
  stop() { clearInterval(this.timer); }
}
module.exports = { SubscriptionService };
