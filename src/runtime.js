import {fulfillmentEligibility,validFulfillment,SERVICE_HOURS} from './fulfillment.js';
import {appShareActions} from './share-app.js';
import {createAdminHandlers,adminOrderControls} from './admin-console.js';
import {bindAdminFilters} from './admin-design.js';
import { approvedPaymentUrl, paymentActions, cartAfterPayment, paymentIssueMessage } from './payments.js';
import { db,result,state,loadPublic,loadUser,can,money,dateTime,statusText,cart,saveCart,orderRequestKey,toggleFavorite,validCPF,formObject } from './data.js';
import { esc,icon,btn,route,field,select,textarea,card,badge,empty,shell,modal,closeModal,toast } from './ui.js';
import { tutor,booking,checkout,storePage,vetPage,courierPage,adminPage,petEditor } from './pages.js';
import { shopHome as home, refreshCatalog as updateCatalog, catalogPage, productPage, sectorPage } from './storefront.js';
import { productImages, productUrl } from './catalog.js';

const path=location.pathname;
const page=path.includes('mundo_pet_produto')?'product':path.includes('mundo_pet_catalogo')?'catalog':path.includes('mundo_pet_banho_tosa')?'grooming':path.includes('mundo_pet_veterinarios')?'veterinary':path.includes('hotel_hospedagem')?'hotel':path.includes('dog_walkers_passeios')?'walkers':path.includes('mundo_pet_farmacia')?'pharmacy':path.includes('cadastro_de_tutor')?'tutor':path.includes('agendamento_de_servi')?'booking':path.includes('carrinho_checkout')?'cart':path.includes('administrativo')?'admin':path.includes('entregador_corridas')?'courier':path.includes('pet_shop_lojista')?'store':path.includes('veterin_rio_agenda')?'vet':'home';
let filter=new URLSearchParams(location.search).get('category')||'';let search=new URLSearchParams(location.search).get('q')||'';let catalogOptions={sort:'relevance',brand:'',inStock:false,maxPrice:0};let detailQuantity=1;let rendering=0;let activeOrder=null;let openingAccount=false;
let locationWatch=null;let locationSent=0;
let deliveryQuote=null;let deliveryQuoteKey='';let deliverySeq=0;
function deliveryFingerprint(){const items=cart();const a=state.profile?.address||{};return JSON.stringify({uid:state.user?.id||'',items,address:a,mode:state.fulfillmentMode});}
async function updateDeliveryQuote(){
 if(page!=='cart')return;
 const status=document.getElementById('mp-delivery-quote-result'),value=document.getElementById('mp-shipping-value'),grand=document.getElementById('mp-grand-total'),actions=document.getElementById('mp-payment-actions'),paymentState=document.getElementById('mp-payment-state'),windowEl=document.getElementById('mp-service-window');
 if(!status)return;
 const key=deliveryFingerprint(),seq=++deliverySeq;deliveryQuote=null;deliveryQuoteKey='';
 const retry=document.getElementById('mp-retry-shipping');if(retry)retry.hidden=true;
 const setEnabled=enabled=>actions?.querySelectorAll('button').forEach(b=>b.disabled=!enabled);
 const message=text=>{status.textContent=text;if(paymentState)paymentState.textContent=text;};
 setEnabled(false);
 const mode=state.fulfillmentMode,items=cart();
 const eligible=fulfillmentEligibility(mode,items,state.products,state.stores,state.profile?.address||{});
 if(!state.user&&mode==='delivery'){message('Entre na sua conta e complete o endereço para receber em casa.');return;}
 if(eligible.error){message(eligible.error);if(grand)grand.textContent='Aguardando dados';return;}
 if(value)value.textContent=mode==='pickup'?'Sem frete':'Calculando…';
 if(grand)grand.textContent='Consultando disponibilidade';
 message(mode==='pickup'?'Confirmando retirada…':'Calculando frete automaticamente…');
 try{
  const schedule=await result(db.rpc('mp_fulfillment_window',{p_store:eligible.store.id}));
  if(seq!==deliverySeq||key!==deliveryFingerprint())return;
  if(windowEl)windowEl.textContent=schedule.is_open?'Atendimento hoje, até as 18h. Aguarde o aviso de pedido pronto.':'Agendado: atendimento a partir de '+dateTime(schedule.starts_at)+'. Aguarde a confirmação e o aviso de pedido pronto.';
  let data={available:true,delivery_cents:0,source:'pickup',schedule};
  if(mode==='delivery'){
   const reply=await withDeadline(()=>db.functions.invoke('mp-delivery-quote',{body:{store_id:eligible.store.id}}),18000);
   if(seq!==deliverySeq||key!==deliveryFingerprint())return;
   if(reply.error||!reply.data?.available||!Number.isSafeInteger(reply.data.delivery_cents)){let info=reply.data;try{if(reply.error?.context?.json)info=await reply.error.context.json();}catch{}throw Error(paymentIssueMessage(info?.error,can('admin')));}
   data={...reply.data,schedule};
  }
  if(seq!==deliverySeq||key!==deliveryFingerprint())return;
  deliveryQuote=data;deliveryQuoteKey=key;
  const subtotal=items.reduce((sum,i)=>sum+(state.products.find(p=>p.id===i.product_id)?.price_cents||0)*i.quantity,0);
  if(value)value.textContent=mode==='pickup'?'Grátis — retirada':money(data.delivery_cents);
  if(grand)grand.textContent=money(subtotal+data.delivery_cents);
  message(mode==='pickup'?'Retirada selecionada, sem frete. Escolha Pix ou cartão.':'Entrega selecionada e frete calculado. Escolha Pix ou cartão.');setEnabled(true);
 }catch(err){if(seq!==deliverySeq)return;message(err?.message||'Não foi possível confirmar a modalidade. Tente novamente.');if(grand)grand.textContent='Aguardando confirmação';if(retry)retry.hidden=false;}
}

const renderers={home,catalog:catalogPage,product:()=>productPage(detailQuantity),veterinary:()=>sectorPage('veterinary'),grooming:()=>sectorPage('grooming'),tutor,booking,cart:checkout,store:storePage,vet:vetPage,courier:courierPage,admin:adminPage,hotel:()=>sectorPage('hotel'),walkers:()=>sectorPage('walkers'),pharmacy:()=>sectorPage('pharmacy')};
async function render() {
 const token=++rendering;
 try {
  const body=await renderers[page]();if(token!==rendering)return;
  shell(page,body,state.user?state.profile?.full_name||'Sua conta conectada':'Mundo Pet');
  if(page==='cart')void updateDeliveryQuote();
  if(page==='product'){const p=state.products.find(p=>p.id===new URLSearchParams(location.search).get('id'));if(p)document.title=p.name+' | Mundo Pet';}
  if(['home','catalog'].includes(page)){updateCatalog(filter,search,catalogOptions);const input=document.getElementById('mp-search');input.value=search;if(page==='home'&&new URLSearchParams(location.search).has('explore'))document.getElementById('mp-catalog')?.scrollIntoView({block:'start'});}
 }catch(error){shell(page,`<div class="mp-runtime-error"><strong>Não foi possível carregar esta página.</strong><p>${esc(friendly(error))}</p>${btn('Tentar novamente','refresh')}</div>`);}
}
function friendly(error) {
 const message=error?.message||String(error);
 if(/Invalid login credentials/i.test(message))return 'Não foi possível entrar com este e-mail e senha. Se você acabou de confirmar o cadastro, tente recuperar a senha.';
 if(/Email not confirmed/i.test(message))return 'Confirme o e-mail no link recebido antes de entrar.';
 if(/mp_profiles_cpf_digits_unique|duplicate key.*cpf|23505.*cpf/i.test(message))return 'Este CPF já está vinculado a outra conta. Entre na conta existente ou solicite suporte.';
 if(/User already registered/i.test(message))return 'Esse e-mail já tem uma conta. Use a opção Entrar.';
 if(/rate limit|too many requests/i.test(message))return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
 if(/Failed to fetch|NetworkError|timeout/i.test(message))return 'Falha de conexão. Verifique sua internet e tente novamente.';
 if(/row-level security|permission denied/i.test(message))return 'Seu perfil não tem permissão para esta ação.';
 if(/duplicate key.*mp_applications/i.test(message))return 'Você já enviou uma solicitação para esse perfil.';
 if(/duplicate key|unique constraint/i.test(message))return 'Esse registro já existe ou o horário acabou de ser reservado.';
 return message;
}
async function refresh() {const previous=new Map(state.orders.map(o=>[o.id,o.status]));await Promise.all([loadPublic(),loadUser()]);await render();const ready=state.orders.find(o=>o.status==='ready'&&previous.has(o.id)&&previous.get(o.id)!=='ready');if(ready)toast(ready.fulfillment_method==='pickup'?'Seu pedido está pronto para retirada. Confira endereço, horário e código em Meus pedidos.':'Seu pedido está pronto e aguarda a coleta do entregador.');}
function requireLogin() {if(state.user)return true;authModal();return false;}

async function getMyOrder(id) {
 if(!state.user||!/^[0-9a-f-]{36}$/i.test(id))throw Error('Entre na sua conta para consultar este pedido.');
 const uid=state.user.id;
 const order=state.orders.find(o=>o.id===id)||await result(db.from('mp_orders').select('*,mp_order_items(*)').eq('id',id).eq('buyer_id',uid).maybeSingle());
 if(!order||order.buyer_id!==uid||state.user?.id!==uid)throw Error('Pedido não encontrado para esta conta.');
 return order;
}
async function paymentInfo(data,error) {
 if(!error)return data;
 try {if(error.context?.json)return await error.context.json();}catch{}
 return data;
}
function openPayment(value) {
 const url=approvedPaymentUrl(value);
 if(!url)throw Error('Não foi possível abrir um endereço seguro de pagamento.');
 window.top.location.assign(url);
}
async function verifyPayment(id) {
 const order=await getMyOrder(id),params=new URLSearchParams(location.search);
 const body={action:'check',order_id:id};
 if(params.get('order_nsu')==='mp-'+id){
  for(const key of ['transaction_nsu','slug']){const value=params.get(key);if(value&&value.length<200)body[key]=value;}
 }
 const {data,error}=await withDeadline(()=>db.functions.invoke('mp-infinitepay',{body}),18000);
 if(error)throw Error('Não foi possível consultar o pagamento agora. Tente Verificar pagamento novamente em instantes.');
 if(data?.paid!==true){toast('Pagamento ainda não confirmado. Aguarde e toque em Verificar pagamento novamente.');return false;}
 const marker='mundopet.paid-cart.'+state.user.id+'.'+id;
 if(localStorage.getItem(marker)!=='1'){
  saveCart(cartAfterPayment(cart(),order.mp_order_items||[]));
  localStorage.setItem(marker,'1');
 }
 if(params.get('order_nsu')==='mp-'+id){
  const clean=new URL(location.href);for(const key of ['receipt_url','order_nsu','slug','capture_method','transaction_nsu'])clean.searchParams.delete(key);
  history.replaceState({},'',clean.pathname+clean.search+clean.hash);
 }
 await refresh();toast('Pagamento confirmado! Acompanhe o pedido em Meus pedidos.');return true;
}

function authModal(mode='login') {
 if(mode==='recover'){modal('Recuperar senha',`<form id="mp-recovery-form" class="mp-stack">${field('email','E-mail cadastrado','','email','required autocomplete="email"')}<p class="mp-muted">Enviaremos um link para redefinir sua senha. Confira também a caixa de spam.</p><p class="mp-error" role="alert"></p><button type="submit" class="mp-btn mp-full">Enviar link de recuperação</button>${btn('Voltar para entrar','login','outline mp-full')}</form>`);return;}

 openingAccount=true;
 modal(mode==='signup'?'Criar minha conta':'Entrar no Mundo Pet',`<form id="mp-auth-form" class="mp-stack" data-mode="${mode}">${mode==='signup'?field('name','Seu nome','','text','required autocomplete="name" maxlength="120"'):''}${field('email','E-mail','','email','required autocomplete="email"')}${field('password','Senha','','password',`required minlength="8" autocomplete="${mode==='signup'?'new-password':'current-password'}"`)}<label class="mp-check"><input type="checkbox" id="mp-show-password"> Mostrar senha</label><p class="mp-error" role="alert"></p><button type="submit" class="mp-btn mp-full">${mode==='signup'?'Criar conta':'Entrar'}</button>${btn(mode==='signup'?'Já tenho conta':'Quero criar minha conta',mode==='signup'?'login':'signup','outline mp-full')}${btn('Esqueci minha senha','recover','outline mp-full')}<p class="mp-muted">Os cadastros de parceiros são analisados pela administração. Criar uma conta não libera acesso aos dados de outras pessoas.</p></form>`);
}
function newPasswordModal(){modal('Definir nova senha',`<form id="mp-new-password-form" class="mp-stack">${field('password','Nova senha','','password','required minlength="8" autocomplete="new-password"')}${field('confirm','Confirmar nova senha','','password','required minlength="8" autocomplete="new-password"')}<p class="mp-error" role="alert"></p><button type="submit" class="mp-btn mp-full">Salvar nova senha</button></form>`);}
function accountModal() {
 if(!state.user){authModal();return;}
 modal('Minha conta',`<p>${esc(state.profile?.full_name||state.user.email)}</p><p class="mp-muted">${esc(state.user.email)}</p><div class="mp-stack" style="margin-top:18px">${state.roles.includes('admin')&&state.user.email?.toLowerCase()==='wap33000@gmail.com'?`<a class="mp-btn" href="${route.admin}">Painel Admin</a>`:''}<a class="mp-btn" href="${route.tutor}">Meus dados e pets</a><a class="mp-btn outline" href="${route.cart}?orders=1">Meus pedidos</a><a class="mp-btn outline" href="${route.booking}">Meus agendamentos</a>${btn('Solicitar acesso profissional','apply','outline')}${btn('Sair da conta','logout','danger')}</div>`);
}
function applicationModal(role='store') {
 if(!requireLogin())return;
 modal('Credenciamento Mundo Pet',`<form id="mp-application-form" class="mp-stack">${select('service_type','Quero me cadastrar como',[['pet_shop','Pet shop / lojista'],['dog_walker','Dog Walker — passeador de cães'],['hotel','Hotel e hospedagem pet'],['daycare','Creche pet'],['grooming','Banho e tosa'],['pharmacy','Farmácia pet'],['veterinary','Veterinário / clínica'],['trainer','Adestrador'],['pet_sitter','Cuidador / Pet Sitter'],['pet_taxi','Transporte pet / Táxi Dog'],['courier','Entregador']],role==='vet'?'veterinary':role==='courier'?'courier':'pet_shop')}${field('name','Nome profissional ou da loja',state.profile?.full_name,'text','required maxlength="120"')}${field('registration','CNPJ / CRMV / CPF ou documento profissional','','text','required maxlength="60"')}${field('address','Endereço de atuação','','text','required maxlength="250"')}${field('phone','Telefone de contato',state.profile?.phone,'tel','required maxlength="25"')}<p class="mp-muted">O administrador analisará seus dados antes de habilitar o painel. O envio não garante aprovação.</p><button type="submit" class="mp-btn">Enviar solicitação</button></form>`);
}
async function adminNewProduct(){
 if(!can('admin'))throw new Error('Acesso restrito ao administrador.');
 const stores=await result(db.from('mp_stores').select('id,name').order('name'));
 if(!stores.length){toast('Cadastre uma loja primeiro.');return;}
 modal('Escolha a loja',`<div class="mp-stack" style="margin-top:16px">${stores.map(t=>btn(t.name,'admin-pick-store','mp-full',`data-id="${t.id}"`)).join('')}</div>`);
}
function adminNewStore(){
 if(!can('admin'))throw new Error('Acesso restrito ao administrador.');
 modal('Cadastrar loja',`<form id="mp-admin-store-form" class="mp-stack">${field('name','Nome da loja','','text','required maxlength="120"')}${field('address','Endereço','','text','maxlength="250"')}${field('phone','Telefone','','tel','maxlength="25"')}<button type="submit" class="mp-btn">Salvar loja</button></form>`);
}
async function productModal(id,storeId) {
 if(!requireLogin())return;
 const p=id?await result(db.from('mp_products').select('*').eq('id',id).single()):{};
 const section=(title,content)=>`<section class="mp-card mp-stack"><h3>${title}</h3>${content}</section>`;
 const checked=(name,label,yes)=>`<label class="mp-row mp-between"><span>${label}</span><input type="checkbox" name="${name}" ${yes?'checked':''}></label>`;
 const price=n=>n==null?'':(n/100).toFixed(2);
 modal(id?'Editar produto':'Cadastrar produto',`<form id="mp-product-form" class="mp-stack" data-id="${esc(id||'')}" data-store="${esc(storeId)}">
 ${section('Fotos do produto',field('main_photo','Foto principal — tirar foto ou escolher arquivo','','file','accept="image/jpeg,image/png,image/webp" capture="environment"')+[1,2,3,4,5].map(i=>field('photo'+i,'Foto adicional '+i,'','file','accept="image/jpeg,image/png,image/webp"')).join('')+(p.image_url?`<p class="mp-muted">Foto principal atual preservada até escolher outra.</p>`:'')+(p.images?.length?`<p class="mp-muted">Fotos adicionais atuais preservadas até escolher novas.</p>`:''))}
 ${section('Informações básicas',field('name','Nome completo',p.name||'','text','required maxlength="150"')+field('ean','Código de barras / QR Code',p.ean||'')+`<button type="button" class="mp-btn outline mp-full" data-action="scan-product-code" data-scan-mode="qr">${icon('qr_code_scanner')} Ler QR Code</button><button type="button" class="mp-btn outline mp-full" data-action="scan-product-code" data-scan-mode="barcode">${icon('barcode')} Ler código de barras (EAN/UPC)</button><button type="button" class="mp-btn outline mp-full" data-action="lookup-product-code">Buscar produto pelo código digitado</button><p class="mp-muted">Aponte para o QR Code ou código de barras. Também é possível digitar o código manualmente.</p>`+field('sku','SKU',p.sku||'')+field('brand','Marca',p.brand||'')+select('category','Categoria',[['Pet Shops','Pet Shops'],['Farmácia','Farmácia'],['Rações','Rações'],['Brinquedos','Brinquedos'],['Higiene','Higiene'],['Acessórios','Acessórios']],p.category||'Pet Shops'))}
 ${section('Preço e disponibilidade',field('price','Preço de venda (R$)',price(p.price_cents),'number','required min="0.01" step="0.01"')+field('old_price','Preço anterior (R$)',price(p.old_price_cents),'number','min="0" step="0.01"')+checked('active','Produto ativo',p.active!==false))}
 ${section('Estoque e logística',field('stock','Estoque atual',p.stock??0,'number','required min="0" step="1"')+field('min_stock','Alerta mínimo',p.min_stock??5,'number','min="0" step="1"')+field('batch_code','Lote',p.batch_code||'')+field('expiry_date','Validade',p.expiry_date||'','date')+checked('auto_stock','Baixa automática',p.auto_stock!==false)+checked('pickup_enabled','Retirada na loja',p.pickup_enabled!==false)+checked('delivery_enabled','Entrega',p.delivery_enabled!==false))}
 ${section('Dimensões',field('weight_kg','Peso (kg) — produtos sólidos',p.weight_kg??'','number','min="0" step="0.01"')+field('volume_ml','Volume (mL) — produtos líquidos',p.volume_ml??'','number','min="0" step="0.01"')+field('height_cm','Altura (cm)',p.height_cm||'','number','min="0" step="0.1"')+field('width_cm','Largura (cm)',p.width_cm||'','number','min="0" step="0.1"')+field('depth_cm','Profundidade (cm)',p.depth_cm||'','number','min="0" step="0.1"'))}
 ${section('Descrição e cuidados',textarea('description','Descrição e modo de usar',p.description||'')+checked('requires_prescription','Exige receita veterinária',p.requires_prescription===true))}
 <button class="mp-btn mp-full" type="submit">Salvar alterações</button></form>`);
}
async function orderDetails(id) {
 if(!requireLogin())return;
 const o=await result(db.from('mp_orders').select('*,mp_order_items(*)').eq('id',id).single());
 const [codes,messages]=await Promise.all([result(db.from('mp_delivery_codes').select('code').eq('order_id',id).maybeSingle()),result(db.from('mp_messages').select('*').eq('order_id',id).order('created_at').limit(100))]);
 activeOrder=o;
 modal('Acompanhamento do pedido',`<div class="mp-stack" style="margin-top:16px"><div class="mp-row mp-between"><strong>#MP-${o.id.slice(0,8).toUpperCase()}</strong>${badge(o.fulfillment_method==='pickup'&&o.status==='ready'?'Pronto para retirada':statusText(o.status))}</div><p class="mp-muted">${dateTime(o.created_at)} • ${o.is_demo?'Demonstração sem cobrança':'Pedido'}</p><div class="mp-stage"><span class="${['pending','preparing'].includes(o.status)?'current':''}">Loja</span><span class="${['ready','assigned'].includes(o.status)?'current':''}">Coleta</span><span class="${o.status==='delivering'?'current':''}">Em entrega</span><span class="${o.status==='delivered'?'current':''}">Concluído</span></div>${o.fulfillment_method==='pickup'?'<p><strong>Retirada na loja — sem frete</strong></p>':''}${o.scheduled_for?'<p>Atendimento a partir de '+dateTime(o.scheduled_for)+'. Aguarde o aviso de pedido pronto.</p>':''}${o.mp_order_items.map(i=>`<div class="mp-labelprice"><span>${i.quantity}× ${esc(i.name)}</span><span>${money(i.unit_cents*i.quantity)}</span></div>`).join('')}${o.discount_cents?`<p>Desconto do cupom: − ${money(o.discount_cents)}</p>`:''}<strong>Total: ${money(o.total_cents)}</strong><p class="mp-muted">Pagamento: ${o.payment_status==='paid'?'confirmado':'não recebido'}</p><p>${icon('location_on')} ${o.fulfillment_method==='pickup'?esc(o.pickup_address||o.address.street):esc(o.address.street)+', '+esc(o.address.number)+' – '+esc(o.address.city)}</p>${codes?card(o.fulfillment_method==='pickup'?'Código de retirada':'Código de entrega',`<strong style="font-size:26px;letter-spacing:4px">${esc(codes.code)}</strong><p class="mp-muted">${o.fulfillment_method==='pickup'?'Informe à loja somente ao receber os produtos.':'Informe ao entregador somente depois de receber seu pedido.'}</p>`):''}${btn('Atualizar acompanhamento','order-details','outline',`data-id="${o.id}"`)}${btn('Imprimir comprovante / etiqueta','print-order','outline',`data-id="${o.id}"`)}${adminOrderControls(o)}<hr class="mp-divider"><h3>Conversa do pedido</h3><div class="mp-stack">${messages.map(m=>`<div class="mp-banner"><small>${m.sender_id===state.user.id?'Você':'Participante do pedido'} • ${dateTime(m.created_at)}</small><p>${esc(m.body)}</p></div>`).join('')||'<p class="mp-muted">Nenhuma mensagem.</p>'}</div><form id="mp-message-form" data-id="${o.id}" class="mp-stack">${textarea('body','Mensagem','','required maxlength="1000"')}<button class="mp-btn" type="submit">Enviar mensagem</button></form></div>`);
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
 const providers=state.roles.includes('admin')?await result(db.rpc('mp_admin_directory')):[];
 modal(id?'Editar serviço':'Novo serviço',`<form id="mp-service-form" class="mp-stack" data-id="${esc(id||'')}">${providers.length?select('provider_id','Responsável pelo serviço',providers.filter(d=>d.roles.some(r=>['vet','store','admin'].includes(r))).map(d=>[d.user_id,d.name]),s.provider_id||state.user.id):''}${field('name','Nome do serviço',s.name,'text','required maxlength="150"')}${field('provider_name','Nome profissional / clínica',s.provider_name||state.profile?.full_name,'text','required maxlength="120"')}${select('category','Categoria',[['Veterinários','Veterinários'],['Banho & Tosa','Banho & Tosa'],['Hospedagem','Hospedagem'],['Dog Walkers','Dog Walkers'],['Farmácia','Farmácia']],s.category||'Veterinários')}<div class="mp-grid">${field('price','Valor (R$)',s.price_cents?(s.price_cents/100).toFixed(2):'','number','required min="0.01" max="100000" step="0.01"')}${field('duration','Duração (minutos)',s.duration_minutes||60,'number','required min="15" max="480" step="15"')}</div>${field('service_photo','Foto do serviço do dispositivo','','file','accept="image/jpeg,image/png,image/webp"')}${s.image_url?'<p class="mp-muted">Foto atual preservada até escolher outra.</p>':''}<p class="mp-muted">Novos serviços são salvos como inativos. Atendimentos comerciais só serão habilitados após concluir a configuração de operação e pagamento.</p><button class="mp-btn" type="submit">Salvar serviço</button></form>`);
}
async function orderStatus(id,status,code='') {
 const message=await result(db.rpc('mp_transition_order',{oid:id,next_status:status,delivery_code:code}));
 if(message!=='ok')throw new Error(message);
 await refresh();toast('Pedido atualizado: '+statusText(status));
}
let productScanStream=null;
let productScanTimer=null;
function stopProductScan(){
 if(productScanTimer){clearInterval(productScanTimer);productScanTimer=null;}
 if(productScanStream){productScanStream.getTracks().forEach(track=>track.stop());productScanStream=null;}
 document.getElementById('mp-product-scan-view')?.remove();
}
async function lookupProductBarcode(raw){
 const form=document.getElementById('mp-product-form');
 if(!form)return;
 const code=String(raw||'').trim();
 if(!/^\\d{8,14}$/.test(code)){toast('Código lido. Busca automática disponível para códigos EAN/UPC numéricos.');return;}
 const set=(name,value)=>{const field=form.elements.namedItem(name);if(field&&value!=null&&String(value).trim()&&!field.value.trim()){field.value=String(value).trim();return true;}return false;};
 try{
  const response=await fetch('https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(code)+'.json?fields=product_name,product_name_pt,brands,quantity,product_quantity,product_quantity_unit,generic_name,image_url',{headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('Serviço de catálogo indisponível');
  const data=await response.json();
  if(data.status!==1||!data.product){toast('Código registrado. Produto não encontrado no catálogo público; complete os dados manualmente.');return;}
  const p=data.product;
  let count=0;
  count+=Number(set('name',p.product_name_pt||p.product_name));
  count+=Number(set('brand',p.brands?.split(',')[0]));
  count+=Number(set('description',p.generic_name));
  const quantity=String(p.quantity||'');
  const ml=quantity.match(/(\\d+(?:[.,]\\d+)?)\\s*(ml|l)\\b/i);
  const volume=ml?Number(ml[1].replace(',','.'))*(ml[2].toLowerCase()==='l'?1000:1):null;
  count+=Number(set('volume_ml',volume||((p.product_quantity_unit||'').toLowerCase()==='ml'?p.product_quantity:null)));
  const kg=quantity.match(/(\\d+(?:[.,]\\d+)?)\\s*(kg|g)\\b/i);
  count+=Number(set('weight_kg',kg?Number(kg[1].replace(',','.'))*(kg[2].toLowerCase()==='g'?.001:1):null));
  toast(count?'Dados encontrados e preenchidos. Confira as informações antes de salvar.':'Produto localizado. Confira e complete os campos manualmente.');
 }catch(error){toast('Não foi possível consultar o catálogo agora. Você pode preencher os dados manualmente.',true);}
}
async function scanProductCode(el){
 const form=document.getElementById('mp-product-form');
 if(!form)throw new Error('Abra o cadastro de produto primeiro.');
 if(!navigator.mediaDevices?.getUserMedia||!('BarcodeDetector' in window))throw new Error('Este navegador não oferece leitura automática. Digite o código manualmente ou tente no Chrome atualizado.');
 const supported=await BarcodeDetector.getSupportedFormats();
 const mode=el?.dataset.scanMode||'barcode';
 const formats=(mode==='qr'?['qr_code']:['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','codabar','data_matrix','pdf417']).filter(x=>supported.includes(x));
 if(!formats.length)throw new Error('Leitor de códigos indisponível neste dispositivo.');
 stopProductScan();
 const detector=new BarcodeDetector({formats});
 const box=document.createElement('div');
 box.id='mp-product-scan-view';box.className='mp-card mp-stack';
 box.innerHTML='<strong>'+ (mode==='qr'?'Aponte para o QR Code':'Aponte para as barras do produto') +'</strong><video autoplay playsinline muted style="width:100%;max-height:260px;object-fit:cover;border-radius:12px"></video><button type="button" class="mp-btn outline" data-action="stop-product-scan">Fechar câmera</button>';
 form.querySelector('[name="ean"]').closest('.mp-field')?.after(box);
 if(!box.isConnected)form.prepend(box);
 try{
  productScanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  const video=box.querySelector('video');video.srcObject=productScanStream;await video.play();
  let busy=false;
  productScanTimer=setInterval(async()=>{
   if(busy||video.readyState<2)return;busy=true;
   try{const found=await detector.detect(video);if(found.length){
    const value=found[0].rawValue;
    form.elements.namedItem('ean').value=value;
    stopProductScan();toast('Código identificado. Buscando dados do produto...');
    await lookupProductBarcode(value);
   }}catch(e){/* continue scanning */}finally{busy=false;}
  },350);
 }catch(error){stopProductScan();throw new Error('Não foi possível acessar a câmera. Confira a permissão do navegador.');}
}
document.addEventListener('click',event=>{if(event.target.closest('[data-action="close-modal"]'))stopProductScan();});
async function addProduct(id,quantity=1){
 const p=state.products.find(p=>p.id===id);
 if(!p||p.stock<1||!Number.isInteger(quantity)||quantity<1)throw Error('Produto indisponível.');
 const items=cart();
 if(items.some(i=>{const product=state.products.find(x=>x.id===i.product_id);return product&&product.store_id!==p.store_id;}))throw Error('Finalize o carrinho da outra loja antes de adicionar este produto.');
 const old=items.find(i=>i.product_id===id),total=(old?.quantity||0)+quantity;
 if(total>Math.min(p.stock,99))throw Error('Quantidade maior que o estoque disponível.');
 if(old)old.quantity=total;else items.push({product_id:id,quantity});
 saveCart(items);
}
function redrawCatalog(){updateCatalog(filter,search,catalogOptions);}
bindAdminFilters();
const adminHandlers=createAdminHandlers({refresh,orderDetails,uploadImage});
const actions={
 'scan-product-code':scanProductCode,
 'lookup-product-code':el=>lookupProductBarcode(document.getElementById('mp-product-form')?.elements.namedItem('ean')?.value),
 'stop-product-scan':stopProductScan,
 home:()=>{location.href=route.home;},account:accountModal,login:()=>authModal(),signup:()=>authModal('signup'),recover:()=>authModal('recover'),'close-modal':closeModal,
 logout:async()=>{await result(db.auth.signOut());state.user=null;await loadUser();closeModal();await render();toast('Você saiu da conta.');},
 refresh:async()=>{await refresh();toast('Dados atualizados.');},
 apply:el=>applicationModal(el.dataset.role||'store'),
 'edit-address':()=>{if(requireLogin())location.href=route.tutor;},
 'add-cart':async el=>{await addProduct(el.dataset.id);await render();toast('Produto adicionado à sacola.');},
 'buy-now':async el=>{await actions['add-cart'](el);location.href=route.cart;},
 favorite:async el=>{toggleFavorite(el.dataset.id);if(['product','pharmacy','grooming'].includes(page))await render();else redrawCatalog();toast('Favoritos atualizados.');},
 filter:el=>{filter=el.dataset.filter;document.querySelectorAll('.mp-category').forEach(n=>n.classList.toggle('active',n.dataset.filter===filter));updateCatalog(filter,search);document.getElementById('mp-catalog')?.scrollIntoView({behavior:'smooth',block:'start'});},
 'clear-filter':()=>{filter='';search='';catalogOptions={sort:'relevance',brand:'',inStock:false,maxPrice:0};const input=document.getElementById('mp-search');if(input)input.value='';const url=new URL(location.href);url.searchParams.delete('category');url.searchParams.delete('q');history.replaceState({},'',url.pathname+url.search+url.hash);redrawCatalog();},
 'catalog':()=>{location.href=route.catalog;},
 'catalog-category':el=>{filter=el.dataset.filter;redrawCatalog();},
 'catalog-stock':()=>{catalogOptions.inStock=!catalogOptions.inStock;redrawCatalog();},
 'catalog-filters':()=>{const categories=[...new Set(state.products.map(p=>p.category))],brands=[...new Set(state.products.map(p=>p.brand).filter(Boolean))];modal('Filtrar catálogo',`<form id="mp-catalog-filter-form" class="mp-stack">${select('category','Categoria',[['','Todas as categorias'],...categories.map(x=>[x,x])],filter)}${select('brand','Marca',[['','Todas as marcas'],...brands.map(x=>[x,x])],catalogOptions.brand)}${field('max_price','Preço máximo (R$)',catalogOptions.maxPrice?catalogOptions.maxPrice/100:'','number','min="0" step="0.01" placeholder="Sem limite"')}<label class="mp-check"><input name="in_stock" type="checkbox" ${catalogOptions.inStock?'checked':''}> Somente produtos em estoque</label><button class="mp-btn" type="submit">Aplicar filtros</button></form>`);},
 'detail-quantity':async el=>{const p=state.products.find(p=>p.id===new URLSearchParams(location.search).get('id'));if(!p)return;detailQuantity=Math.max(1,Math.min(99,p.stock,detailQuantity+Number(el.dataset.change)));await render();},
 'add-detail-cart':async el=>{await addProduct(el.dataset.id,detailQuantity);await render();toast('Produto adicionado à sacola.');},
 'buy-detail':async el=>{await addProduct(el.dataset.id,detailQuantity);location.href=route.cart;},
 'product-image':el=>{const p=state.products.find(p=>p.id===el.dataset.id),images=p?productImages(p):[],index=Number(el.dataset.index);if(!images[index])return;const photo=document.getElementById('mp-detail-image');if(photo)photo.src=images[index];const count=document.getElementById('mp-gallery-count');if(count)count.textContent=(index+1)+' / '+images.length;document.querySelectorAll('.mp-gallery-thumbs button').forEach(b=>b.classList.toggle('selected',b===el));},
 'product-zoom':el=>{const p=state.products.find(p=>p.id===el.dataset.id),src=document.getElementById('mp-detail-image')?.src;if(p&&src)modal(p.name,`<img src="${esc(src)}" alt="${esc(p.name)}" class="mp-zoom-image">`);},
 'share-product':async()=>{const id=new URLSearchParams(location.search).get('id');if(!id)return;const url=new URL(productUrl(id),location.origin).href;try{await navigator.clipboard.writeText(url);toast('Link do produto copiado.');}catch{modal('Compartilhar produto',`<p>Copie o link abaixo:</p><input class="mp-input" aria-label="Link do produto" readonly value="${esc(url)}">`);}},
 explore:()=>{document.getElementById('mp-catalog')?.scrollIntoView({behavior:'smooth',block:'start'});document.getElementById('mp-search')?.focus();},
 'book-service':el=>{sessionStorage.setItem('mundopet.service',el.dataset.id);location.href=route.booking;},
 'edit-pet':el=>{const p=state.pets.find(p=>p.id===el.dataset.id);modal('Editar pet',petEditor(p));},
 'cart-quantity':async el=>{const items=cart();const item=items.find(i=>i.product_id===el.dataset.id);if(!item)return;const qty=item.quantity+Number(el.dataset.change);const p=state.products.find(p=>p.id===item.product_id);if(qty>Math.min(p?.stock||0,99))throw new Error('Quantidade maior que o estoque disponível.');item.quantity=qty;saveCart(items);await render();},
 'remove-cart':async el=>{saveCart(cart().filter(i=>i.product_id!==el.dataset.id));await render();},
 checkout:async(el)=>{
  if(!requireLogin())return;
  const a=state.profile?.address,items=cart();
  if(!validFulfillment(state.fulfillmentMode))throw Error('Escolha entrega ou retirada antes de pagar.');
  if(state.fulfillmentMode==='delivery'&&(!a?.street||!a.number||!a.city||!a.state))throw Error('Complete o endereço no perfil.');
  if(!items.length)throw Error('Seu carrinho está vazio.');
  if(!deliveryQuote||deliveryQuoteKey!==deliveryFingerprint())throw Error('Aguarde a confirmação da modalidade antes de pagar.');
  const method=el.dataset.method;
  if(!['infinitepay_pix','infinitepay_card'].includes(method))throw Error('Selecione Pix ou cartão.');
  const {data,error}=await withDeadline(()=>db.functions.invoke('mp-secure-checkout',{body:{cart:items,request_id:orderRequestKey(),payment_method:method,fulfillment_method:state.fulfillmentMode}}),40000);
  if(error||!data?.url){
   const info=await paymentInfo(data,error);
   if(['payment_link_failed','payment_url_invalid'].includes(info?.error)){await loadUser();await render();}
   throw Error(paymentIssueMessage(info?.error,can('admin')));
  }
  openPayment(data.url);
 },
 'resume-payment':async el=>{
  if(!requireLogin())return;
  const order=await getMyOrder(el.dataset.id);
  if(!paymentActions(order).pay)throw Error('Este pedido não está disponível para pagamento. Atualize Meus pedidos.');
  const {data,error}=await withDeadline(()=>db.functions.invoke('mp-infinitepay',{body:{action:'create',order_id:order.id}}),22000);
  if(error||!data?.url)throw Error('Não foi possível abrir o pagamento deste pedido. Tente novamente em instantes.');
  openPayment(data.url);
 },
 'check-payment':async el=>{if(requireLogin())await verifyPayment(el.dataset.id);},
 'order-status':el=>orderStatus(el.dataset.id,el.dataset.status),
 'order-details':el=>orderDetails(el.dataset.id),
 'print-order':()=>{if(!activeOrder)return;const o=activeOrder;const w=window.open('','_blank');if(!w)throw new Error('Permita abrir a janela de impressão no navegador.');w.document.write(`<!doctype html><html lang="pt-BR"><head><title>Pedido Mundo Pet</title><style>body{font:16px system-ui;padding:28px;max-width:700px}h1{color:#006c49}li{margin:10px 0}</style></head><body><img src="${location.origin}/media/brand/mundo-pet-logo.png" alt="Mundo Pet" style="width:230px;height:auto"><h2>Pedido #${o.id.slice(0,8)}</h2><p>${o.is_demo?'DEMONSTRAÇÃO — SEM COBRANÇA':'Comprovante do pedido'}</p><p>${dateTime(o.created_at)}</p><ul>${o.mp_order_items.map(i=>`<li>${i.quantity}× ${esc(i.name)} • ${money(i.unit_cents*i.quantity)}</li>`).join('')}</ul>${o.discount_cents?`<p>Desconto do cupom: − ${money(o.discount_cents)}</p>`:''}<strong>Total: ${money(o.total_cents)}</strong><p>Pagamento: ${o.payment_status==='paid'?'confirmado':'não recebido'}</p><p>Entrega: ${esc(o.address.street)}, ${esc(o.address.number)} • ${esc(o.address.city)}</p><button onclick="window.print()">Imprimir</button></body></html>`);w.document.close();},
 'toggle-store':async el=>{const s=state.stores.find(s=>s.id===el.dataset.id);await result(db.from('mp_stores').update({is_open:!s.is_open}).eq('id',s.id));await refresh();toast('Disponibilidade da loja atualizada.');},
 'store-filter':el=>{document.querySelectorAll('[data-order-status]').forEach(n=>n.hidden=el.dataset.filter!=='all'&&n.dataset.orderStatus!==el.dataset.filter);},
 'review-product':async el=>{if(!state.roles.includes('admin'))throw new Error('Acesso restrito.');await result(db.from('mp_products').update({approval_status:el.dataset.status,active:el.dataset.status==='approved'}).eq('id',el.dataset.id));await refresh();toast('Solicitação de produto analisada.');},
 'adopt-catalog':el=>{modal('Adicionar produto à loja',`<form id="mp-adopt-catalog-form" data-id="${esc(el.dataset.id)}" data-store="${esc(el.dataset.store)}" class="mp-stack">${field('price','Seu preço de venda (R$)','','number','required min="0.01" step="0.01"')}${field('stock','Quantidade em estoque',0,'number','required min="0" step="1"')}<button class="mp-btn" type="submit">Adicionar produto</button></form>`);},
 'admin-new-product':()=>adminNewProduct(),
 'admin-new-store':()=>adminNewStore(),
 'admin-pick-store':el=>productModal('',el.dataset.id),
 'product-editor':el=>productModal(el.dataset.id,el.dataset.store),
 'toggle-product':async el=>{if(!state.roles.includes('admin'))throw new Error('Ativação depende da aprovação do administrador.');await result(db.from('mp_products').update({active:el.dataset.active==='true',...(el.dataset.active==='true'?{approval_status:'approved'}:{})}).eq('id',el.dataset.id).select('id').single());await refresh();toast('Produto atualizado.');},
 'share-courier-location':()=>shareCourierLocation(),
 'toggle-online':async()=>{if(!state.profile){await result(db.from('mp_profiles').insert({user_id:state.user.id,full_name:state.user.email,online:true,presence_updated_at:new Date().toISOString()}));}else await result(db.from('mp_profiles').update({online:!state.profile.online,presence_updated_at:new Date().toISOString()}).eq('user_id',state.user.id));await refresh();if(!state.profile?.online&&locationWatch!==null){navigator.geolocation.clearWatch(locationWatch);locationWatch=null;}},
 'choose-fulfillment':async el=>{if(!validFulfillment(el.dataset.mode))return;state.fulfillmentMode=el.dataset.mode;localStorage.removeItem('mundopet.order-request');await render();},
 'pickup-complete':el=>modal('Confirmar retirada',`<form class="mp-stack mp-delivery-form" data-id="${esc(el.dataset.id)}">${field('code','Código do cliente (6 dígitos)','','text','required pattern="[0-9]{6}" inputmode="numeric" maxlength="6"')}<p>Confirme somente após entregar os produtos ao cliente.</p><button class="mp-btn" type="submit">Validar código e concluir retirada</button></form>`),
 'retry-shipping':async()=>{await updateDeliveryQuote();},
 'quote-shipping':async()=>{if(!requireLogin())return;const items=cart();if(!items.length)throw new Error('Adicione produtos ao carrinho.');const product=state.products.find(p=>p.id===items[0].product_id);if(!product)throw new Error('Produto indisponível.');const el=document.getElementById('mp-delivery-quote-result');if(el)el.textContent='Calculando distância da loja até seu endereço…';const {data,error}=await db.functions.invoke('mp-delivery-quote',{body:{store_id:product.store_id}});if(error){if(el)el.textContent='Não foi possível calcular o frete. Verifique o endereço e tente novamente.';throw new Error('Frete indisponível no momento.');}if(!data?.available){if(el)el.textContent='Entrega indisponível. Confira o endereço e a configuração de rotas.';return;}if(el)el.textContent='Frete estimado: '+money(data.delivery_cents)+' • '+(data.distance_m/1000).toFixed(2).replace('.',',')+' km pela rota. Valor sujeito à confirmação no checkout.';},
 'map-route':async el=>{const o=await result(db.from('mp_orders').select('address').eq('id',el.dataset.id).single());const a=o.address;const dest=[a.street,a.number,a.city,a.state].filter(Boolean).join(', ');window.open('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(dest),'_blank','noopener,noreferrer');},
 'appointment-status':async el=>{await result(db.rpc('mp_transition_appointment',{aid:el.dataset.id,next_status:el.dataset.status}));closeModal();await refresh();toast('Agendamento atualizado.');},
 clinical:el=>clinicalModal(el.dataset.id),
 'service-editor':el=>serviceModal(el.dataset.id),
 'toggle-service':async el=>{if(!can('admin'))throw new Error('A publicação depende da aprovação do administrador.');await result(db.rpc('mp_review_service',{p_service:el.dataset.id,p_approve:el.dataset.active==='true'}));await refresh();toast('Serviço atualizado.');},
 'review-service':async el=>{if(!can('admin'))throw new Error('Acesso restrito.');await result(db.rpc('mp_review_service',{p_service:el.dataset.id,p_approve:el.dataset.approved==='true'}));closeModal();await refresh();toast('Serviço analisado.');},
 'review-application':async el=>{await result(db.rpc('mp_review_application',{aid:el.dataset.id,approved:el.dataset.approved==='true'}));await refresh();toast('Solicitação analisada.');},
 ...adminHandlers.actions,
 ...appShareActions,
};
document.addEventListener('click',async event=>{const el=event.target.closest('[data-action]');if(!el)return;const action=actions[el.dataset.action];if(!action)return;event.preventDefault();if(el.disabled)return;el.disabled=true;try{await action(el);}catch(error){toast(friendly(error),true);}finally{if(el.isConnected)el.disabled=false;}});

async function uploadImage(form,name) {
 const file=form.elements.namedItem(name)?.files?.[0];
 if(!file)return null;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Escolha uma imagem JPG, PNG ou WebP de até 5 MB.');
 if(!state.user)throw new Error('Entre na sua conta para enviar fotos.');
 const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
 const path=state.user.id+'/'+crypto.randomUUID()+'.'+ext;
 await result(db.storage.from('mp-catalog-images').upload(path,file,{contentType:file.type,upsert:false}));
 const {data}=db.storage.from('mp-catalog-images').getPublicUrl(path);
 return data.publicUrl;
}
const forms={
 'mp-catalog-filter-form':async(form,v)=>{filter=v.category;catalogOptions.brand=v.brand;catalogOptions.inStock=form.elements.in_stock.checked;catalogOptions.maxPrice=Math.max(0,Math.round(Number(v.max_price||0)*100));closeModal();redrawCatalog();},
 'mp-recovery-form':async(form,v)=>{const {error}=await db.auth.resetPasswordForEmail(v.email.trim(),{redirectTo:location.origin+route.home+'?recovery=1'});if(error)throw error;modal('Verifique seu e-mail',`<p>Se o endereço estiver cadastrado, você receberá um link para criar uma nova senha.</p>${btn('Voltar para entrar','login','mp-full')}`);},
 'mp-new-password-form':async(form,v)=>{if(v.password!==v.confirm)throw new Error('As senhas não coincidem.');const {error}=await db.auth.updateUser({password:v.password});if(error)throw error;closeModal();await loadUser();await render();toast('Senha alterada com sucesso.');},
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
 'mp-application-form':async(form,v)=>{await result(db.from('mp_applications').insert({user_id:state.user.id,role:v.service_type==='veterinary'?'vet':v.service_type==='courier'?'courier':'store',service_type:v.service_type,name:v.name.trim(),registration:v.registration.trim(),address:v.address.trim(),phone:v.phone.trim()}));closeModal();await render();toast('Solicitação enviada para análise.');},
 'mp-admin-store-form':async(form,v)=>{
  if(!can('admin'))throw new Error('Acesso restrito.');
  await result(db.from('mp_stores').insert({owner_id:state.user.id,name:v.name.trim(),address:v.address.trim(),phone:v.phone.trim(),is_open:true}));
  closeModal();await render();toast('Loja cadastrada.');
 },
 'mp-adopt-catalog-form':async(form,v)=>{const price=Math.round(Number(v.price)*100);const stock=Number(v.stock);if(!Number.isSafeInteger(price)||price<1||!Number.isInteger(stock)||stock<0)throw new Error('Informe preço e estoque válidos.');await result(db.rpc('mp_adopt_catalog_product',{p_source:form.dataset.id,p_store:form.dataset.store,p_price:price,p_stock:stock}));closeModal();await refresh();toast('Produto adicionado à sua loja.');},
 'mp-product-form':async(form,v)=>{
  const original=form.dataset.id?await result(db.from('mp_products').select('image_url,images').eq('id',form.dataset.id).single()):{};
  const main=await uploadImage(form,'main_photo');
  const added=(await Promise.all([1,2,3,4,5].map(i=>uploadImage(form,'photo'+i)))).filter(Boolean);
  const photos=added.length?added:(original.images||[]);
  const cents=value=>value===''||value==null?null:Math.round(Number(value)*100);
  const numeric=value=>value===''||value==null?null:Number(value);
  const on=name=>form.elements.namedItem(name)?.checked===true;
  const payload={store_id:form.dataset.store,name:v.name.trim(),category:v.category,price_cents:cents(v.price),old_price_cents:cents(v.old_price),stock:Number(v.stock),min_stock:Number(v.min_stock||0),image_url:main||original.image_url||'',images:photos,ean:v.ean.trim(),sku:v.sku.trim(),brand:v.brand.trim(),description:v.description.trim(),batch_code:v.batch_code.trim(),expiry_date:v.expiry_date||null,weight_kg:numeric(v.weight_kg),volume_ml:numeric(v.volume_ml),height_cm:numeric(v.height_cm),width_cm:numeric(v.width_cm),depth_cm:numeric(v.depth_cm),active:on('active'),auto_stock:on('auto_stock'),pickup_enabled:on('pickup_enabled'),delivery_enabled:on('delivery_enabled'),requires_prescription:on('requires_prescription')};
  if(!payload.name||!Number.isFinite(payload.price_cents)||payload.price_cents<1)throw new Error('Informe nome e preço válido.');
  const admin=state.roles.includes('admin');
  if(!admin){payload.approval_status='pending';payload.active=false;payload.submitted_by=state.user.id;}
  await result(form.dataset.id?db.from('mp_products').update(payload).eq('id',form.dataset.id):db.from('mp_products').insert(payload));
  closeModal();await refresh();toast('Produto salvo no catálogo.');
 },
 'mp-store-form':async(form,v)=>{await result(db.from('mp_stores').update({name:v.name.trim(),address:v.address.trim(),phone:v.phone.trim()}).eq('id',form.dataset.id));await refresh();toast('Perfil da loja salvo.');},
 'mp-service-form':async(form,v)=>{const existing=form.dataset.id?await result(db.from('mp_services').select('image_url,provider_id').eq('id',form.dataset.id).single()):{};const image=await uploadImage(form,'service_photo');const payload={provider_id:state.roles.includes('admin')?(v.provider_id||existing.provider_id||state.user.id):state.user.id,name:v.name.trim(),provider_name:v.provider_name.trim(),category:v.category,price_cents:Math.round(Number(v.price)*100),duration_minutes:Number(v.duration),image_url:image||existing.image_url||''};await result(form.dataset.id?db.from('mp_services').update(payload).eq('id',form.dataset.id):db.from('mp_services').insert({...payload,active:false}));closeModal();await refresh();toast('Serviço salvo.');},
 'mp-message-form':async(form,v)=>{await result(db.from('mp_messages').insert({order_id:form.dataset.id,sender_id:state.user.id,body:v.body.trim()}));await orderDetails(form.dataset.id);toast('Mensagem enviada no pedido.');},
 'mp-clinical-form':async(form,v)=>{await result(db.from('mp_clinical_notes').insert({appointment_id:form.dataset.id,provider_id:state.user.id,body:v.body.trim()}));await clinicalModal(form.dataset.id);toast('Anotação salva.');},
 ...adminHandlers.forms,
};
document.addEventListener('submit',async event=>{const form=event.target;const handler=form.classList.contains('mp-delivery-form')?(f,v)=>orderStatus(f.dataset.id,'delivered',v.code):forms[form.id];if(!handler)return;event.preventDefault();const button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;try{await handler(form,formObject(form));}catch(error){const errorBox=form.querySelector('.mp-error');if(errorBox)errorBox.textContent=friendly(error);else toast(friendly(error),true);}finally{if(button.isConnected)button.disabled=false;}});
document.addEventListener('input',event=>{if(event.target.id==='mp-search'){search=event.target.value;redrawCatalog();}});
document.addEventListener('change',event=>{
 if(event.target.id==='mp-catalog-sort'){catalogOptions.sort=event.target.value;redrawCatalog();}
 if(event.target.id==='mp-show-password'){const input=document.querySelector('#mp-auth-form [name="password"]');input.type=event.target.checked?'text':'password';}
 if(event.target.closest('#mp-booking-form')){const form=document.getElementById('mp-booking-form');const v=formObject(form);const price=state.services.find(s=>s.id===v.service)?.price_cents||0;const total=document.getElementById('mp-booking-total');if(total)total.textContent=money(price+({home:3000,taxi:4000}[v.mode]||0));}
});

// Render the approved storefront immediately. Network requests must never block the Home.
const withDeadline=(operation,ms=9000)=>Promise.race([
 Promise.resolve().then(operation),
 new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo limite de conexão excedido. Confira a conexão e tente novamente.')),ms))
]);
async function confirmPaymentReturn(){
 const params=new URLSearchParams(location.search),nsu=params.get('order_nsu');
 if(page!=='cart'||!nsu||!/^mp-[0-9a-f-]{36}$/i.test(nsu))return;
 if(!state.user){toast('Entre na sua conta para confirmar o pagamento e acompanhar o pedido.',true);return;}
 try{await verifyPayment(nsu.slice(3));}
 catch{toast('Não foi possível consultar o pagamento agora. Tente Verificar pagamento em Meus pedidos.',true);}
}

async function init(){
 await render();
 const {data:{session},error}=await withDeadline(()=>db.auth.getSession());if(error)throw error;state.user=session?.user||null;
 await withDeadline(()=>Promise.all([loadPublic(),loadUser()]));await render();
 const authParams=new URLSearchParams(location.search);
 if(authParams.has('recovery')&&state.user)newPasswordModal();
 else if(authParams.has('login')){if(!state.user)authModal();else toast('E-mail confirmado. Sua conta está conectada.');}
 const callbackError=new URLSearchParams(location.hash.slice(1)).get('error_description')||authParams.get('error_description');
 if(callbackError)toast('Link inválido ou expirado. Use Esqueci minha senha para solicitar outro.',true);
 await confirmPaymentReturn();
}
db.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY'){state.user=session?.user||null;setTimeout(newPasswordModal,0);}
 if(event==='TOKEN_REFRESHED')state.user=session?.user||null;
 if(event==='SIGNED_OUT'){if(locationWatch!==null){navigator.geolocation?.clearWatch(locationWatch);locationWatch=null;}state.user=null;setTimeout(()=>{loadUser().then(render);},0);}
 if(event==='SIGNED_IN'&&!state.user&&!openingAccount){state.user=session?.user||null;setTimeout(()=>{loadUser().then(render);},0);}
});
init().catch(async error=>{
 // Preserve the public storefront, even if auth or the database is unavailable.
 if(page==='home'){
  await render();
  const target=document.querySelector('.mp-body');
  if(target)target.insertAdjacentHTML('afterbegin',`<div class="mp-runtime-error" role="alert"><strong>Não foi possível atualizar os dados agora.</strong><p>${esc(friendly(error))}</p><button class="mp-btn outline small" type="button" onclick="location.reload()">Tentar novamente</button></div>`);
 }else shell(page,`<div class="mp-runtime-error"><strong>Falha ao conectar ao Mundo Pet</strong><p>${esc(friendly(error))}</p><button class="mp-btn outline" type="button" onclick="location.reload()">Tentar novamente</button></div>`);
});
// Poll operational pages without replacing a form or interrupting ongoing typing.
if(['store','vet','courier','admin','cart'].includes(page))setInterval(()=>{
 if(!state.user||document.hidden||document.querySelector('[role="dialog"]')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 refresh().catch(error=>toast(friendly(error),true));
},15000);

async function shareCourierLocation(){
 if(!state.user||!can('courier')||!state.profile?.online)throw Error('Ative sua disponibilidade para compartilhar localização.');
 if(!navigator.geolocation)throw Error('Seu navegador não oferece localização.');
 if(locationWatch!==null){navigator.geolocation.clearWatch(locationWatch);locationWatch=null;toast('Compartilhamento encerrado.');return;}
 locationWatch=navigator.geolocation.watchPosition(async position=>{
  if(!state.user||!state.profile?.online||!can('courier')){if(locationWatch!==null)navigator.geolocation.clearWatch(locationWatch);locationWatch=null;return;}
  if(Date.now()-locationSent<10000)return;locationSent=Date.now();
  try{const active=await result(db.from('mp_orders').select('id').eq('courier_id',state.user.id).in('status',['assigned','delivering']));
   if(!active.length)return;
   const rows=active.map(o=>({order_id:o.id,courier_id:state.user.id,latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy_m:position.coords.accuracy,updated_at:new Date().toISOString()}));
   await result(db.from('mp_courier_locations').upsert(rows));
  }catch(error){toast(friendly(error),true);}
 },()=>{if(locationWatch!==null)navigator.geolocation.clearWatch(locationWatch);locationWatch=null;toast('Não foi possível obter a localização. Confira a permissão do navegador.',true);},{enableHighAccuracy:true,maximumAge:15000,timeout:15000});
 toast('Localização compartilhada durante as suas entregas. Toque novamente para encerrar.');
}
setInterval(async()=>{
 if(page==='courier'&&state.user&&state.profile?.online&&document.visibilityState==='visible'){
  await db.from('mp_profiles').update({presence_updated_at:new Date().toISOString()}).eq('user_id',state.user.id);
 }
 if(locationWatch!==null&&(!state.user||!state.profile?.online)){navigator.geolocation.clearWatch(locationWatch);locationWatch=null;}
},60000);
setInterval(()=>{if(page==='admin'&&state.roles.includes('admin')&&document.visibilityState==='visible'&&!document.querySelector('[role="dialog"]')&&!document.querySelector('input:focus,select:focus,textarea:focus'))void render();},30000);

