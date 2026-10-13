document.getElementById('activate').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.target.querySelector('button');const notice=document.getElementById('notice');button.disabled=true;notice.textContent='Validando a chave…';
  try{
    const response=await fetch('/admin/activation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:document.getElementById('token').value}),signal:AbortSignal.timeout(12000)});
    const state=await response.json();if(!response.ok)throw Error(state.error||'Não foi possível validar.');
    document.getElementById('token').value='';notice.textContent=state.allowed?'Chave salva e assinatura liberada. Voltando ao telão…':'Chave salva. A assinatura ainda está bloqueada ou vencida; entre em contato com a NexaReis.';
    if(state.allowed)setTimeout(()=>location.assign('/'),1500);
  }catch(error){notice.textContent=error.message;}finally{button.disabled=false;}
});
