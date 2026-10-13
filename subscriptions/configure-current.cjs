const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const data=JSON.parse(fs.readFileSync(path.join(root,'.secrets/subscription-deployment.json'),'utf8'));
const envPath=path.join(root,'server/.env');let content=fs.readFileSync(envPath,'utf8');
const settings={SUBSCRIPTION_ENABLED:'true',SUBSCRIPTION_URL:'https://chamador-assinaturas.nicolas-santapaula.workers.dev',SUBSCRIPTION_CUSTOMER_ID:data.customerId,SUBSCRIPTION_TOKEN:data.token,SUBSCRIPTION_PUBLIC_KEY:data.publicKey};
if(!fs.existsSync(path.join(root,'.secrets/server-env-before-subscriptions.txt')))fs.copyFileSync(envPath,path.join(root,'.secrets/server-env-before-subscriptions.txt'));
for(const [key,value]of Object.entries(settings)){const re=new RegExp('^'+key+'=.*$','m');content=re.test(content)?content.replace(re,key+'='+value):content+'\n'+key+'='+value;}
fs.writeFileSync(envPath,content+'\n');console.log('Instalação atual vinculada à central. Reinicie o servidor para aplicar.');
