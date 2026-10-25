import { db,result,state,loadPublic,loadUser,can,money,dateTime,statusText,cart,saveCart,orderRequestKey,toggleFavorite,validCPF,formObject } from './data.js';
import { esc,icon,btn,route,field,select,textarea,card,badge,empty,shell,modal,closeModal,toast } from './ui.js';
import { home,updateCatalog,tutor,booking,checkout,storePage,vetPage,courierPage,adminPage,petEditor } from './pages.js';

const path=location.pathname;
const page=path.includes('cadastro_de_tutor')?'tutor':path.includes('agendamento_de_servi')?'booking':path.includes('carrinho_checkout')?'cart':path.includes('administrativo')?'admin':path.includes('entregador_corridas')?'courier':path.includes('pet_shop_lojista')?'store':path.includes('veterin_rio_agenda')?'vet':'home';
let filter='';let search='';let rendering=0;let activeOrder=null;let openingAccount=false;
const renderers={home,tutor,booking,cart:checkout,store:storePage,vet:vetPage,courier:courierPage,admin:adminPage};
async function render() {
 const token=++rendering;
 try {
  const body=await renderers[page]();if(token!==rendering)return;
  shell(page,body,state.user?state.profile?.full_name||'Sua conta conectada':'Mundo Pet');
  if(page==='home'){updateCatalog(filter,search);const input=document.getElementById('mp-search');if(input)input.value=search;if(new URLSearchParams(location.search).has('explore'))requestAnimationFrame(()=>setTimeout(()=>document.getElementById('mp-catalog')?.scrollIntoView({behavior:'smooth',block:'start'}),100));}
 }catch(error){shell(page,`<div class="mp-runtime-error"><strong>Não foi possível carregar esta página.</strong><p>${esc(friendly(error))}</p>${btn('Tentar novamente','refresh')}</div>`);}
}
function friendly(error) {
 const message=error?.message||String(error);
 if(/Invalid login credentials/i.test(message))return 'Não foi possível entrar com este e-mail e senha. Se você acabou de confirmar o cadastro, tente recuperar a senha.';
 if(/Email not confirmed/i.test(message))return 'Confirme o e-mail no link recebido antes de entrar.';
 if(/User already registered/i.test(message))return 'Esse e-mail já tem uma conta. Use a opção Entrar.';
 if(/rate limit|too many requests/i.test(message))return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
 if(/Failed to fetch|NetworkError|timeout/i.test(message))return 'Falha de conexão. Verifique sua internet e tente novamente.';
 if(/row-level security|permission denied/i.test(message))return 'Seu perfil não tem permissão para esta ação.';
 if(/duplicate key.*mp_applications/i.test(message))return 'Você já enviou uma solicitação para esse perfil.';
 if(/duplicate key|unique constraint/i.test(message))return 'Esse registro já existe ou o horário acabou de ser reservado.';
 return message;
}
async function refresh() {await Promise.all([loadPublic(),loadUser()]);await render();}
function requireLogin() {if(state.user)return true;authModal();return false;}
function authModal(mode='login') {
 if(mode==='recover'){modal('Recuperar senha',`<form id="mp-recovery-form" class="mp-stack">${field('email','E-mail cadastrado','','email','required autocomplete="email"')}<p class="mp-muted">Enviaremos um link para redefinir sua senha. Confira também a caixa de spam.</p><p class="mp-error" role="alert"></p><button type="submit" class="mp-btn mp-full">Enviar link de recuperação</button>${btn('Voltar para entrar','login','outline mp-full')}</form>`);return;}

 openingAccount=true;
 modal(mode==='signup'?'Criar minha conta':'Entrar no Mundo Pet',`<form id="mp-auth-form" class="mp-stack" data-mode="${mode}">${mode==='signup'?field('name','Seu nome','','text','required autocomplete="name" maxlength="120"'):''}${field('email','E-mail','','email','required autocomplete="email"')}${field('password','Senha','','password',`required minlength="8" autocomplete="${mode==='signup'?'new-password':'current-password'}"`)}<label class="mp-check"><input type="checkbox" id="mp-show-password"> Mostrar senha</label><p class="mp-error" role="alert"></p><button type="submit" class="mp-btn mp-full">${mode==='signup'?'Criar conta':'Entrar'}</button>${btn(mode==='signup'?'Já tenho conta':'Quero criar minha conta',mode==='signup'?'login':'signup','outline mp-full')}${btn('Esqueci minha senha','recover','outline mp-full')}<p class="mp-muted">Os cadastros de parceiros são analisados pela administração. Criar uma conta não libera acesso aos dados de outras pessoas.</p></form>`);
}
function newPasswordModal(){modal('Criar nova senha',`<p class="mp-muted">Digite sua nova senha duas vezes para confirmar a alteração.</p><form id="mp-new-password-form" class="mp-stack">${field('password','Nova senha','','password','required minlength="8" autocomplete="new-password"')}${field('confirm','Confirmar nova senha','','password','required minlength="8" autocomplete="new-password"')}<p class="mp-error" role="alert"></p><button type="submit" class="mp-btn mp-full">Salvar nova senha</button></form>`);}
function accountModal() {
 if(!state.user){authModal();return;}
 modal('Minha conta',`<p>${esc(state.profile?.full_name||state.user.email)}</p><p class="mp-muted">${esc(state.user.email)}</p><div class="mp-stack" style="margin-top:18px"><a class="mp-btn" href="${route.tutor}">Meus dados e pets</a><a class="mp-btn outline" href="${route.cart}?orders=1">Meus pedidos</a><a class="mp-btn outline" href="${route.booking}">Meus agendamentos</a>${btn('Solicitar acesso profissional','apply','outline')}${btn('Sair da conta','logout','danger')}</div>`);
}
function applicationModal(role='store') {
 if(!requireLogin())return;
 modal('Credenciamento Mundo Pet',`<form id="mp-application-form" class="mp-stack">${select('role','Quero me cadastrar como',[['store','Pet shop / lojista'],['vet','Veterinário'],['courier','Entregador']],role)}${field('name','Nome profissional ou da loja',state.profile?.full_name,'text','required maxlength="120"')}${field('registration','CNPJ / CRMV / documento profissional','','text','required maxlength="60"')}${field('address','Endereço de atuação','','text','required maxlength="250"')}${field('phone','Telefone de contato',state.profile?.phone,'tel','required maxlength="25"')}<p class="mp-muted">O administrador analisará seus dados antes de habilitar o painel. O envio não garante aprovação.</p><button type="submit" class="mp-btn">Enviar solicitação</button></form>`);
}
async function productModal(id,storeId) {
 if(!requireLogin())return;
 const p=id?await result(db.from('mp_products').select('*').eq('id',id).single()):{};
 const x=p.details||{};
 const checked=k=>x[k]?'checked':'';
 const yesno=(k,label)=>`<label class="mp-check"><input type="checkbox" name="${k}" ${checked(k)}> ${label}</label>`;
 modal(id?'Editar produto':'Cadastrar produto',`<form id="mp-product-form" class="mp-stack" data-id="${esc(id||'')}" data-store="${esc(storeId||p.store_id||'')}">
 <div class="mp-row mp-between"><strong>Fotos do produto</strong><span class="mp-muted">Imagem principal HTTPS</span></div>
 ${p.image_url?`<img src="${esc(p.image_url)}" alt="Imagem atual do produto" style="max-height:200px;object-fit:contain;border-radius:12px">`:''}
 ${field('image_url','URL da foto principal',p.image_url,'url','required placeholder="https://..."')}
 ${field('image_2','Segunda foto (URL HTTPS)',x.image_2,'url','placeholder="https://..."')}
 ${field('image_3','Terceira foto (URL HTTPS)',x.image_3,'url','placeholder="https://..."')}
 <h3>Informações básicas</h3>
 ${field('name','Nome completo do produto',p.name,'text','required maxlength="150"')}
 <div class="mp-grid">${select('category','Categoria',[['Pet Shops','Pet Shops'],['Farmácia','Farmácia']],p.category||'Pet Shops')}${field('barcode','Código de barras (EAN/GTIN)',x.barcode,'text','maxlength="20" inputmode="numeric"')}</div>
 <div class="mp-grid">${field('sku','SKU da loja',x.sku,'text','maxlength="60"')}${field('brand','Marca / fabricante',x.brand,'text','maxlength="100"')}</div>
 ${field('classification','Classificação do catálogo',x.classification,'text','maxlength="120"')}
 <h3>Preço e repasse</h3>
 <div class="mp-grid">${field('price','Preço de venda (R$)',p.price_cents?(p.price_cents/100).toFixed(2):'','number','required min="0.01" max="100000" step="0.01"')}${field('compare_price','Preço anterior (R$)',x.compare_price??'','number','min="0" step="0.01"')}</div>
 <p class="mp-muted">O recebimento líquido depende das taxas e regras reais da plataforma. Nenhum repasse automático é prometido por esta tela.</p>
 <h3>Estoque e logística da loja</h3>
 <div class="mp-grid">${field('stock','Estoque físico atual',p.stock??0,'number','required min="0" max="999999" step="1"')}${field('min_stock','Alerta de estoque mínimo',x.min_stock??5,'number','min="0" step="1"')}</div>
 <div class="mp-grid">${field('batch','Identificador do lote',x.batch,'text','maxlength="80"')}${field('expiry','Validade do lote',x.expiry,'date')}</div>
 ${yesno('auto_decrement','Baixa automática do estoque após venda')}
 ${yesno('pickup','Permitir retirada em loja')}
 ${yesno('delivery','Disponível para entrega')}
 <h3>Dimensões e envio</h3>
 ${field('weight','Peso bruto embalado (kg)',x.weight,'number','min="0" step="0.001"')}
 <div class="mp-grid">${field('length','Altura (cm)',x.length,'number','min="0" step="0.1"')}${field('width','Largura (cm)',x.width,'number','min="0" step="0.1"')}${field('depth','Profundidade (cm)',x.depth,'number','min="0" step="0.1"')}</div>
 <h3>Descrição e modo de usar</h3>
 ${textarea('description','Descrição nutricional e benefícios',x.description,'maxlength="5000"')}
 ${yesno('prescription','Exige receita veterinária')}
 <button class="mp-btn mp-full" type="submit">Salvar alterações</button>
 </form>`);
}
async function orderDetails(id) {
 if(!requireLogin())return;
 const o=await result(db.from('mp_orders').select('*,mp_order_items(*)').eq('id',id).single());
 const [codes,messages]=await Promise.all([result(db.from('mp_delivery_codes').select('code').eq('order_id',id).maybeSingle()),result(db.from('mp_messages').select('*').eq('order_id',id).order('created_at').limit(100))]);
 activeOrder=o;
 modal('Acompanhamento do pedido',`<div class="mp-stack" style="margin-top:16px"><div class="mp-row mp-between"><strong>#MP-${o.id.slice(0,8).toUpperCase()}</strong>${badge(statusText(o.status))}</div><p class="mp-muted">${dateTime(o.created_at)} • ${o.is_demo?'Demonstração sem cobrança':'Pedido'}</p><div class="mp-stage"><span class="${['pending','preparing'].includes(o.status)?'current':''}">Loja</span><span class="${['ready','assigned'].includes(o.status)?'current':''}">Coleta</span><span class="${o.status==='delivering'?'current':''}">Em entrega</span><span class="${o.status==='delivered'?'current':''}">Concluído</span></div>${o.mp_order_items.map(i=>`<div class="mp-labelprice"><span>${i.quantity}× ${esc(i.name)}</span><span>${money(i.unit_cents*i.quantity)}</span></div>`).join('')}${o.discount_cents?`<p>Desconto do cupom: − ${money(o.discount_cents)}</p>`:''}<strong>Total: ${money(o.total_cents)}</strong><p class="mp-muted">Pagamento: ${o.payment_status==='paid'?'confirmado':'não recebido'}</p><p>${icon('location_on')} ${esc(o.address.street)}, ${esc(o.address.number)} – ${esc(o.address.city)}</p>${codes?card('Código de entrega',`<strong style="font-size:26px;letter-spacing:4px">${esc(codes.code)}</strong><p class="mp-muted">Informe ao entregador somente depois de receber seu pedido.</p>`):''}${btn('Atualizar acompanhamento','order-details','outline',`data-id="${o.id}"`)}${btn('Imprimir comprovante / etiqueta','print-order','outline',`data-id="${o.id}"`)}<hr class="mp-divider"><h3>Conversa do pedido</h3><div class="mp-stack">${messages.map(m=>`<div class="mp-banner"><small>${m.sender_id===state.user.id?'Você':'Participante do pedido'} • ${dateTime(m.created_at)}</small><p>${esc(m.body)}</p></div>`).join('')||'<p class="mp-muted">Nenhuma mensagem.</p>'}</div><form id="mp-message-form" data-id="${o.id}" class="mp-stack">${textarea('body','Mensagem','','required maxlength="1000"')}<button class="mp-btn" type="submit">Enviar mensagem</button></form></div>`);
}
async function clinicalModal(id) {
 const a=await result(db.from('mp_appointments').select('*,mp_pets(*)').eq('id',id).single());
 const notes=await result(db.from('mp_clinical_notes').select('*').eq('appointment_id',id).order('created_at',{ascending:false}));
 const p=a.mp_pets;
 modal('Prontuário do atendimento',`<div class="mp-stack" style="margin-top:16px"><h3>${esc(p?.name||'Pet')} • ${esc(p?.breed||'')}</h3><p class="mp-muted">${p?.weight||'—'} kg • ${esc(p?.age||'Idade não informada')}</p><p>Alergias: ${esc(p?.allergies||'Não informadas')}</p><p>Cuidados: ${esc(p?.medications||'Não informados')}</p><p class="mp-muted">Anotações de acompanhamento. Receitas digitais com assinatura e teleconsulta não estão habilitadas.</p>${notes.map(n=>`<article class="mp-banner"><small>${dateTime(n.created_at)}</small><p style="white-space:pre-wrap">${esc(n.body)}</p></article>`).join('')}<form id="mp-clinical-form" data-id="${id}" class="mp-stack">${textarea('body','Anotação clínica','','required maxlength="10000"')}<button class="mp-btn" type="submit">Salvar anotação no prontuário</button></form></div>`);
}
async function serviceModal(id) {
 if(!requireLogin())return;
 const s=id?await result(db.from('mp_services').select('*').eq('id',id).single()):{};
 modal(id?'Editar serviço':'Novo serviço',`<form id="mp-service-form" class="mp-stack" data-id="${esc(id||'')}">${field('name','Nome do serviço',s.name,'text','required maxlength="150"')}${field('provider_name','Nome profissional / clínica',s.provider_name||state.profile?.full_name,'text','required maxlength="120"')}${select('category','Categoria',[['Veterinários','Veterinários'],['Banho & Tosa','Banho & Tosa'],['Hospedagem','Hospedagem'],['Dog Walkers','Dog Walkers']],s.category||'Veterinários')}<div class="mp-grid">${field('price','Valor (R$)',s.price_cents?(s.price_cents/100).toFixed(2):'','number','required min="0.01" max="100000" step="0.01"')}${field('duration','Duração (minutos)',s.duration_minutes||60,'number','required min="15" max="480" step="15"')}</div>${field('image_url','Foto do serviço (HTTPS)',s.image_url,'url')}<p class="mp-muted">Novos serviços são salvos como inativos. Atendimentos comerciais só serão habilitados após concluir a configuração de operação e pagamento.</p><button class="mp-btn" type="submit">Salvar serviço</button></form>`);
}
async function orderStatus(id,status,code='') {
 const message=await result(db.rpc('mp_transition_order',{oid:id,next_status:status,delivery_code:code}));
 if(message!=='ok')throw new Error(message);
 await refresh();toast('Pedido atualizado: '+statusText(status));
}
const actions={
 home:()=>{location.href=route.home;},account:accountModal,login:()=>authModal(),signup:()=>authModal('signup'),recover:()=>authModal('recover'),'close-modal':closeModal,
 logout:async()=>{await result(db.auth.signOut());state.user=null;await loadUser();closeModal();await render();toast('Você saiu da conta.');},
 refresh:async()=>{await refresh();toast('Dados atualizados.');},
 apply:el=>applicationModal(el.dataset.role||'store'),
 'edit-address':()=>{if(requireLogin())location.href=route.tutor;},
 'add-cart':async el=>{const p=state.products.find(p=>p.id===el.dataset.id);if(!p||p.stock<1)throw new Error('Produto indisponível.');const items=cart();const other=items.map(i=>state.products.find(p=>p.id===i.product_id)).some(x=>x&&x.store_id!==p.store_id);if(other)throw new Error('Finalize o carrinho da outra loja antes de adicionar este produto.');const old=items.find(i=>i.product_id===p.id);if(old){if(old.quantity>=Math.min(p.stock,99))throw new Error('Limite de estoque atingido.');old.quantity++;}else items.push({product_id:p.id,quantity:1});saveCart(items);await render();toast('Produto adicionado ao carrinho.');},
 favorite:async el=>{toggleFavorite(el.dataset.id);updateCatalog(filter,search);toast('Favoritos atualizados.');},
 filter:el=>{filter=el.dataset.filter;document.querySelectorAll('.mp-category').forEach(n=>n.classList.toggle('active',n.dataset.filter===filter));updateCatalog(filter,search);document.getElementById('mp-catalog')?.scrollIntoView({behavior:'smooth',block:'start'});},
 'clear-filter':()=>{filter='';search='';if(document.getElementById('mp-search'))document.getElementById('mp-search').value='';document.querySelectorAll('.mp-category').forEach(n=>n.classList.remove('active'));updateCatalog();},
 explore:()=>{if(page!=='home'){location.href=route.home+'?explore=1';return;}filter='';search='';updateCatalog();document.querySelectorAll('.mp-category').forEach(n=>n.classList.remove('active'));const input=document.getElementById('mp-search');if(input)input.value='';document.getElementById('mp-catalog')?.scrollIntoView({behavior:'smooth',block:'start'});},
 'book-service':el=>{sessionStorage.setItem('mundopet.service',el.dataset.id);location.href=route.booking;},
 'edit-pet':el=>{const p=state.pets.find(p=>p.id===el.dataset.id);modal('Editar pet',petEditor(p));},
 'cart-quantity':async el=>{const items=cart();const item=items.find(i=>i.product_id===el.dataset.id);if(!item)return;const qty=item.quantity+Number(el.dataset.change);const p=state.products.find(p=>p.id===item.product_id);if(qty>Math.min(p?.stock||0,99))throw new Error('Quantidade maior que o estoque disponível.');item.quantity=qty;saveCart(items);await render();},
 'remove-cart':async el=>{saveCart(cart().filter(i=>i.product_id!==el.dataset.id));await render();},
 checkout:async()=>{if(!requireLogin())return;const a=state.profile?.address;if(!a?.street||!a.number||!a.city)throw new Error('Cadastre rua, número e cidade no seu perfil.');const items=cart();if(!items.length)throw new Error('Seu carrinho está vazio.');const id=await result(db.rpc('mp_checkout',{cart:items,delivery_address:a,request_id:orderRequestKey(),coupon:sessionStorage.getItem('mundopet.coupon')||''}));saveCart([]);await refresh();await orderDetails(id);toast('Pedido de demonstração criado. Nenhum valor foi cobrado.');},
 'order-status':el=>orderStatus(el.dataset.id,el.dataset.status),
 'order-details':el=>orderDetails(el.dataset.id),
 'print-order':()=>{if(!activeOrder)return;const o=activeOrder;const w=window.open('','_blank');if(!w)throw new Error('Permita abrir a janela de impressão no navegador.');w.document.write(`<!doctype html><html lang="pt-BR"><head><title>Pedido Mundo Pet</title><style>body{font:16px system-ui;padding:28px;max-width:700px}h1{color:#006c49}li{margin:10px 0}</style></head><body><h1>Mundo Pet</h1><h2>Pedido #${o.id.slice(0,8)}</h2><p>${o.is_demo?'DEMONSTRAÇÃO — SEM COBRANÇA':'Comprovante do pedido'}</p><p>${dateTime(o.created_at)}</p><ul>${o.mp_order_items.map(i=>`<li>${i.quantity}× ${esc(i.name)} • ${money(i.unit_cents*i.quantity)}</li>`).join('')}</ul>${o.discount_cents?`<p>Desconto do cupom: − ${money(o.discount_cents)}</p>`:''}<strong>Total: ${money(o.total_cents)}</strong><p>Pagamento: ${o.payment_status==='paid'?'confirmado':'não recebido'}</p><p>Entrega: ${esc(o.address.street)}, ${esc(o.address.number)} • ${esc(o.address.city)}</p><button onclick="window.print()">Imprimir</button></body></html>`);w.document.close();},
 'toggle-store':async el=>{const s=state.stores.find(s=>s.id===el.dataset.id);await result(db.from('mp_stores').update({is_open:!s.is_open}).eq('id',s.id));await refresh();toast('Disponibilidade da loja atualizada.');},
 'store-filter':el=>{document.querySelectorAll('[data-order-status]').forEach(n=>n.hidden=el.dataset.filter!=='all'&&n.dataset.orderStatus!==el.dataset.filter);},
 'product-editor':el=>productModal(el.dataset.id,el.dataset.store),
 'toggle-product':async el=>{await result(db.from('mp_products').update({active:el.dataset.active==='true'}).eq('id',el.dataset.id));await refresh();toast('Produto atualizado.');},
 'toggle-online':async()=>{if(!state.profile){await result(db.from('mp_profiles').insert({user_id:state.user.id,full_name:state.user.email,online:true}));}else await result(db.from('mp_profiles').update({online:!state.profile.online}).eq('user_id',state.user.id));await refresh();},
 'map-route':async el=>{const o=await result(db.from('mp_orders').select('address').eq('id',el.dataset.id).single());const a=o.address;const dest=[a.street,a.number,a.city,a.state].filter(Boolean).join(', ');window.open('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(dest),'_blank','noopener,noreferrer');},
 'appointment-status':async el=>{await result(db.rpc('mp_transition_appointment',{aid:el.dataset.id,next_status:el.dataset.status}));await refresh();toast('Agendamento atualizado.');},
 clinical:el=>clinicalModal(el.dataset.id),
 'service-editor':el=>serviceModal(el.dataset.id),
 'toggle-service':async el=>{await result(db.from('mp_services').update({active:el.dataset.active==='true'}).eq('id',el.dataset.id));await refresh();toast('Disponibilidade do serviço atualizada.');},
 'review-application':async el=>{await result(db.rpc('mp_review_application',{aid:el.dataset.id,approved:el.dataset.approved==='true'}));await refresh();toast('Solicitação analisada.');},
};
document.addEventListener('click',async event=>{const el=event.target.closest('[data-action]');if(!el)return;const action=actions[el.dataset.action];if(!action)return;event.preventDefault();if(el.disabled)return;el.disabled=true;try{await action(el);}catch(error){toast(friendly(error),true);}finally{if(el.isConnected)el.disabled=false;}});

const forms={
 'mp-recovery-form':async(form,v)=>{const {error}=await db.auth.resetPasswordForEmail(v.email.trim(),{redirectTo:location.origin+route.home+'?reset-password=1'});if(error)throw error;modal('Verifique seu e-mail',`<p>Se o endereço estiver cadastrado, você receberá um link para criar uma nova senha.</p>${btn('Voltar para entrar','login','mp-full')}`);},
 'mp-new-password-form':async(form,v)=>{if(v.password!==v.confirm)throw new Error('As senhas não coincidem.');const {error}=await db.auth.updateUser({password:v.password});if(error)throw error;await db.auth.signOut();state.user=null;closeModal();history.replaceState({},'',route.home+'?login=1');await loadUser();await render();authModal('login');toast('Senha alterada! Entre com sua nova senha.');},
 'mp-coupon-form':async(form,v)=>{const code=v.coupon.trim().toUpperCase();if(code&&code!=='MUNDOPET10')throw new Error('Cupom inválido. No catálogo de demonstração, use MUNDOPET10.');sessionStorage.setItem('mundopet.coupon',code);localStorage.removeItem('mundopet.order-request');await render();toast(code?'Cupom de demonstração aplicado.':'Cupom removido.');},
 'mp-auth-form':async(form,v)=>{
  if(form.dataset.mode==='signup'){
   const {data,error}=await db.auth.signUp({email:v.email.trim(),password:v.password,options:{data:{full_name:v.name.trim()},emailRedirectTo:location.origin+route.home+'?login=1'}});if(error)throw error;
   if(!data.session){modal('Verifique seu cadastro',`<p style="margin-top:16px">Se você já possui uma conta, não precisa se cadastrar novamente: escolha Entrar ou Esqueci minha senha. Para contas novas, verifique sua caixa de entrada e spam para confirmar o endereço.</p><p class="mp-muted">Se o endereço já tiver cadastro, use a opção Entrar. Não compartilhe sua senha ou o link de confirmação.</p>${btn('Ir para entrar','login','mp-full')}`);return;}
   state.user=data.user;
  }else {const {data,error}=await db.auth.signInWithPassword({email:v.email.trim(),password:v.password});if(error)throw error;state.user=data.user;}
  await loadUser();closeModal();await render();toast('Conta conectada.');
 },
 'mp-profile-form':async(form,v)=>{
  if(!state.user)throw new Error('Entre na sua conta.');
  if(v.full_name.trim().length<2)throw new Error('Informe seu nome completo.');
  if(v.cpf&&!validCPF(v.cpf))throw new Error('Confira o CPF informado.');
  if(v.zip&&!/^\d{5}-?\d{3}$/.test(v.zip))throw new Error('Informe um CEP com 8 dígitos.');
  const payload={user_id:state.user.id,full_name:v.full_name.trim(),phone:v.phone.trim(),cpf:v.cpf.replace(/\D/g,''),address:{zip:v.zip,district:v.district.trim(),street:v.street.trim(),number:v.number.trim(),complement:v.complement.trim(),city:v.city.trim(),state:v.state.toUpperCase()}};
  await result(db.from('mp_profiles').upsert(payload));await loadUser();toast('Seus dados foram salvos.');
 },
 'mp-pet-form':async(form,v)=>{
  if(!state.user)throw new Error('Entre na sua conta.');
  const payload={owner_id:state.user.id,name:v.name.trim(),species:v.species,breed:v.breed.trim(),size:v.size,age:v.age.trim(),weight:v.weight?Number(v.weight):null,vaccinated:v.vaccinated==='on',neutered:v.neutered==='on',allergies:v.allergies.trim(),medications:v.medications.trim()};
  if(!payload.name)throw new Error('Informe o nome do animal.');
  const file=form.querySelector('[name="photo"]')?.files?.[0];
  if(file){
   if(!['image/jpeg','image/png'].includes(file.type)||file.size>5*1024*1024)throw new Error('Use uma foto JPG ou PNG de até 5 MB.');
   const photoPath=`${state.user.id}/${crypto.randomUUID()}.${file.type==='image/png'?'png':'jpg'}`;
   await result(db.storage.from('mp-pets').upload(photoPath,file,{contentType:file.type,upsert:false}));
   payload.photo_path=photoPath;
  }
  await result(form.dataset.id?db.from('mp_pets').update(payload).eq('id',form.dataset.id).eq('owner_id',state.user.id):db.from('mp_pets').insert(payload));
  await loadUser();await render();toast('Pet salvo com sucesso.');
 },
 'mp-booking-form':async(form,v)=>{
  const slot=`${v.date}T${v.time}:00-03:00`;
  await result(db.rpc('mp_book_appointment',{service:v.service,pet:v.pet,slot,attendance:v.mode,observation:v.notes}));
  await loadUser();await render();toast('Agendamento de demonstração salvo. Nenhum atendimento real foi contratado.');
 },
 'mp-application-form':async(form,v)=>{await result(db.from('mp_applications').insert({user_id:state.user.id,role:v.role,name:v.name.trim(),registration:v.registration.trim(),address:v.address.trim(),phone:v.phone.trim()}));closeModal();await render();toast('Solicitação enviada para análise.');},
 'mp-product-form':async(form,v)=>{
  for(const key of ['image_url','image_2','image_3'])if(v[key]&&!v[key].startsWith('https://'))throw new Error('As imagens devem usar URL HTTPS.');
  if(Number(v.compare_price||0)>0&&Number(v.compare_price)<Number(v.price))throw new Error('O preço anterior deve ser maior que o preço de venda.');
  const detailKeys=['image_2','image_3','barcode','sku','brand','classification','compare_price','min_stock','batch','expiry','weight','length','width','depth','description'];
  const details=Object.fromEntries(detailKeys.map(k=>[k,v[k]??'']));
  for(const key of ['auto_decrement','pickup','delivery','prescription'])details[key]=!!form.elements.namedItem(key)?.checked;
  const payload={store_id:form.dataset.store,name:v.name.trim(),category:v.category,price_cents:Math.round(Number(v.price)*100),stock:Number(v.stock),image_url:v.image_url.trim(),details};
  if(!payload.store_id)throw new Error('Loja não identificada.');
  await result(form.dataset.id?db.from('mp_products').update(payload).eq('id',form.dataset.id):db.from('mp_products').insert(payload));
  await refresh();toast('Produto salvo com sucesso.');
 },
 'mp-store-form':async(form,v)=>{await result(db.from('mp_stores').update({name:v.name.trim(),address:v.address.trim(),phone:v.phone.trim()}).eq('id',form.dataset.id));await refresh();toast('Perfil da loja salvo.');},
 'mp-service-form':async(form,v)=>{if(v.image_url&&!v.image_url.startsWith('https://'))throw new Error('Use uma imagem com HTTPS.');const payload={provider_id:state.user.id,name:v.name.trim(),provider_name:v.provider_name.trim(),category:v.category,price_cents:Math.round(Number(v.price)*100),duration_minutes:Number(v.duration),image_url:v.image_url.trim()};await result(form.dataset.id?db.from('mp_services').update(payload).eq('id',form.dataset.id):db.from('mp_services').insert({...payload,active:false}));await refresh();toast('Serviço salvo.');},
 'mp-message-form':async(form,v)=>{await result(db.from('mp_messages').insert({order_id:form.dataset.id,sender_id:state.user.id,body:v.body.trim()}));await orderDetails(form.dataset.id);toast('Mensagem enviada no pedido.');},
 'mp-clinical-form':async(form,v)=>{await result(db.from('mp_clinical_notes').insert({appointment_id:form.dataset.id,provider_id:state.user.id,body:v.body.trim()}));await clinicalModal(form.dataset.id);toast('Anotação salva.');},
};
document.addEventListener('submit',async event=>{const form=event.target;const handler=form.classList.contains('mp-delivery-form')?(f,v)=>orderStatus(f.dataset.id,'delivered',v.code):forms[form.id];if(!handler)return;event.preventDefault();const button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;try{await handler(form,formObject(form));}catch(error){const errorBox=form.querySelector('.mp-error');if(errorBox)errorBox.textContent=friendly(error);else toast(friendly(error),true);}finally{if(button.isConnected)button.disabled=false;}});
document.addEventListener('input',event=>{if(event.target.id==='mp-search'){search=event.target.value;updateCatalog(filter,search);}});
document.addEventListener('change',event=>{
 if(event.target.id==='mp-show-password'){const input=document.querySelector('#mp-auth-form [name="password"]');input.type=event.target.checked?'text':'password';}
 if(event.target.closest('#mp-booking-form')){const form=document.getElementById('mp-booking-form');const v=formObject(form);const price=state.services.find(s=>s.id===v.service)?.price_cents||0;const total=document.getElementById('mp-booking-total');if(total)total.textContent=money(price+({home:3000,taxi:4000}[v.mode]||0));}
});

shell(page,`<div class="mp-empty" role="status">Carregando Mundo Pet…</div>`);
async function init(){
 const {data:{session},error}=await db.auth.getSession();if(error)throw error;state.user=session?.user||null;
 await Promise.all([loadPublic(),loadUser()]);await render();
 const authParams=new URLSearchParams(location.search);
 const hashParams=new URLSearchParams(location.hash.slice(1));
 const callbackError=hashParams.get('error_description')||authParams.get('error_description');
 if(callbackError){modal('Link inválido ou expirado',`<p>O link de recuperação expirou ou já foi utilizado. Solicite um novo e-mail para definir sua senha.</p>${btn('Solicitar novo link','recover','mp-full')}`);return;}
 if(authParams.has('reset-password')||authParams.has('recovery')){
  if(state.user)newPasswordModal();
  else modal('Verificando link de recuperação',`<p>Se o link foi aberto diretamente do e-mail, aguarde a validação. Se ele expirou, solicite outro.</p>${btn('Solicitar outro link','recover','outline mp-full')}`);
 }else if(authParams.has('login')){if(!state.user)authModal();else toast('E-mail confirmado. Sua conta está conectada.');}
}
db.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY'){state.user=session?.user||null;setTimeout(newPasswordModal,0);}
 if(event==='SIGNED_IN'&&new URLSearchParams(location.search).has('reset-password')&&session?.user){state.user=session.user;setTimeout(newPasswordModal,0);}
 if(event==='TOKEN_REFRESHED')state.user=session?.user||null;
 if(event==='SIGNED_OUT'){state.user=null;setTimeout(()=>{loadUser().then(render);},0);}
 if(event==='SIGNED_IN'&&!state.user&&!openingAccount){state.user=session?.user||null;setTimeout(()=>{loadUser().then(render);},0);}
});
init().catch(error=>{shell(page,`<div class="mp-runtime-error"><strong>Falha ao conectar ao Mundo Pet</strong><p>${esc(friendly(error))}</p>${btn('Tentar novamente','refresh')}</div>`);});
// Poll operational pages without replacing a form or interrupting ongoing typing.
if(['store','vet','courier','admin'].includes(page))setInterval(()=>{
 if(!state.user||document.hidden||document.querySelector('[role="dialog"]')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 refresh().catch(error=>toast(friendly(error),true));
},15000);
