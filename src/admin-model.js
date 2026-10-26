export const isPublishedCampaign = (c, now=Date.now()) => c.active && (!c.starts_at||Date.parse(c.starts_at)<=now) && (!c.ends_at||Date.parse(c.ends_at)>now);
export function campaignLink(value) {
 const text=String(value||'').trim();
 if(/^\/mundo_pet_[a-z_]+\/(?:\?[^\s]*)?$/.test(text))return text;
 try {const url=new URL(text);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;}catch{}
 throw Error('Use uma página do Mundo Pet ou um endereço HTTPS válido.');
}
export function percentBps(value){const n=Number(value);if(!Number.isFinite(n)||n<0||n>100||Math.abs(n*100-Math.round(n*100))>1e-6)throw Error('Informe uma taxa de 0 a 100%, com até duas casas decimais.');return Math.round(n*100);}
export function moneyCents(value){const n=Number(value);if(!Number.isFinite(n)||n<=0||!Number.isSafeInteger(Math.round(n*100))||Math.abs(n*100-Math.round(n*100))>1e-6)throw Error('Informe um valor positivo, com até duas casas decimais.');return Math.round(n*100);}
export function filterOrders(orders,{q='',status='',store='',courier='',from='',to='',history=false}={}){
 const needle=q.trim().toLocaleLowerCase('pt-BR');
 return orders.filter(o=>!o.is_demo&&(!history||['delivered','canceled'].includes(o.status))&&(!status||o.status===status)&&(!store||o.store_id===store)&&(!courier||o.courier_id===courier)&&(!needle||[o.id,...(o.mp_order_items||[]).map(i=>i.name)].join(' ').toLocaleLowerCase('pt-BR').includes(needle))&&(!from||Date.parse(o.created_at)>=Date.parse(from+'T00:00:00-03:00'))&&(!to||Date.parse(o.created_at)<=Date.parse(to+'T23:59:59.999-03:00')));
}
export function financeTotals({entries=[],settlements=[],payouts=[]},walletId=null,now=Date.now()){
 const credits=walletId?entries.filter(e=>e.wallet_id===walletId):settlements.map(s=>({amount_cents:s.commission_cents,available_at:s.available_at}));
 const balance=credits.reduce((s,e)=>s+Number(e.amount_cents),0);
 const matured=credits.filter(e=>Date.parse(e.available_at)<=now).reduce((s,e)=>s+Number(e.amount_cents),0);
 const requests=payouts.filter(p=>(p.wallet_id||null)===walletId);
 const reserved=requests.filter(p=>p.status==='requested').reduce((s,p)=>s+Number(p.amount_cents),0);
 const paid=walletId?0:requests.filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.amount_cents),0);
 return {balance:balance-paid,reserved,pending:Math.max(0,balance-matured),available:Math.max(0,matured-reserved-paid)};
}
export function buildNotifications(model){
 const list=[];
 for(const a of model.applications||[])if(a.status==='pending')list.push({key:'application:'+a.id,title:'Credenciamento: '+a.name,detail:'Cadastro aguardando análise',tab:'applications',created_at:a.created_at});
 for(const p of model.products||[])if(p.approval_status==='pending')list.push({key:'product:'+p.id,title:'Produto: '+p.name,detail:'Produto aguardando aprovação',tab:'products',created_at:p.created_at});
 for(const s of model.services||[])if(!s.active)list.push({key:'service:'+s.id,title:'Serviço: '+s.name,detail:'Serviço inativo para análise',tab:'services'});
 for(const o of model.orders||[])if(!o.is_demo&&!['delivered','canceled'].includes(o.status))list.push({key:'order:'+o.id+':'+o.status,title:'Pedido #'+o.id.slice(0,8),detail:o.status==='ready'?'Aguardando entregador':'Pedido em andamento',tab:'orders',created_at:o.updated_at});
 for(const p of model.payouts||[])if(p.status==='requested')list.push({key:'payout:'+p.id,title:'Repasse para '+p.recipient,detail:'Solicitação aguardando transferência e conferência',tab:'finance',created_at:p.created_at});
 const read=new Set((model.reads||[]).map(r=>r.notification_key));
 return list.map(n=>({...n,read:read.has(n.key)})).sort((a,b)=>Number(a.read)-Number(b.read)||(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));
}
export const csvCell=value=>'"'+String(value??'').replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')+'"';
export const csvRows=rows=>'\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
