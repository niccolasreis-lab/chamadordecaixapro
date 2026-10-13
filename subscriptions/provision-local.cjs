// Gera credenciais sem imprimir segredos. Execute somente na máquina do proprietário.
const fs=require('fs');const path=require('path');const crypto=require('crypto');
const root=path.resolve(__dirname,'..');const dir=path.join(root,'.secrets');fs.mkdirSync(dir,{recursive:true});
const target=path.join(dir,'subscription-deployment.json');
if(fs.existsSync(target)){console.log('Credenciais existentes preservadas.');process.exit(0);}
const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
const token=crypto.randomBytes(32).toString('base64');const password=crypto.randomBytes(24).toString('base64url');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const data={customerId:crypto.randomUUID(),customerName:'Instalação atual — '+(process.env.COMPUTERNAME||'Loja local'),token,tokenHash:hash(token),adminPasswordHash:hash(password),
  signingKey:privateKey.export({format:'der',type:'pkcs8'}).toString('base64'),publicKey:publicKey.export({format:'der',type:'spki'}).toString('base64')};
fs.writeFileSync(target,JSON.stringify(data,null,2));
fs.writeFileSync(path.join(dir,'acesso-assinaturas.txt'),'PAINEL DE ASSINATURAS NEXAREIS\n\nURL: https://chamador-assinaturas.nicolas-santapaula.workers.dev/\nUsuário: admin\nSenha: '+password+'\n\nCliente desta instalação: '+data.customerId+'\nChave de ativação: '+token+'\n\nGuarde este arquivo apenas com o proprietário. Não distribua a senha do painel às lojas.\n');
console.log('Credenciais geradas e guardadas na pasta .secrets. Nenhum segredo foi impresso.');
