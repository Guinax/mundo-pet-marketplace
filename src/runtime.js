import { db,result,state,loadPublic,loadUser,can,money,dateTime,statusText,cart,saveCart,orderRequestKey,toggleFavorite,validCPF,formObject } from './data.js';
import { esc,icon,btn,route,field,select,textarea,card,badge,empty,shell,modal,closeModal,toast } from './ui.js';
import { home,updateCatalog,tutor,booking,checkout,storePage,vetPage,courierPage,adminPage,petEditor,specialtyPage } from './pages.js';

const path=location.pathname;
const page=path.includes('hotel_hospedagem')?'hotel':path.includes('dog_walkers_passeios')?'walkers':path.includes('mundo_pet_farmacia')?'pharmacy':path.includes('cadastro_de_tutor')?'tutor':path.includes('agendamento_de_servi')?'booking':path.includes('carrinho_checkout')?'cart':path.includes('administrativo')?'admin':path.includes('entregador_corridas')?'courier':path.includes('pet_shop_lojista')?'store':path.includes('veterin_rio_agenda')?'vet':'home';
let filter='';let search='';let rendering=0;let activeOrder=null;let openingAccount=false;
let deliveryQuote=null;let deliveryQuoteKey='';let deliverySeq=0;
function deliveryFingerprint(){const items=cart();const a=state.profile?.address||{};return JSON.stringify({uid:state.user?.id||'',items,address:a});}
async function updateDeliveryQuote(){
 if(page!=='cart')return;
 const status=document.getElementById('mp-delivery-quote-result'),value=document.getElementById('mp-shipping-value'),grand=document.getElementById('mp-grand-total'),actions=document.getElementById('mp-payment-actions');
 if(!status)return;
 const key=deliveryFingerprint(),seq=++deliverySeq;deliveryQuote=null;deliveryQuoteKey='';
 if(actions)actions.querySelectorAll('button').forEach(b=>b.disabled=true);
 if(value)value.textContent='Calculando…';if(grand)grand.textContent='Calculando…';
 const items=cart(),a=state.profile?.address||{};
 if(!state.user||!a.street||!a.number||!a.city||!a.state){status.textContent='Entre na conta e complete seu endereço para calcular o frete automaticamente.';if(value)value.textContent='Endereço pendente';return;}
 if(!items.length)return;
 const stores=[...new Set(items.map(i=>state.products.find(p=>p.id===i.product_id)?.store_id))];
 if(stores.length!==1||!stores[0]){status.textContent='Para finalizar, selecione produtos de uma única loja.';if(value)value.textContent='Indisponível';return;}
 status.textContent='Calculando automaticamente a rota até seu endereço…';
 try{
 const {data,error}=await db.functions.invoke('mp-delivery-quote',{body:{store_id:stores[0]}});
 if(seq!==deliverySeq||key!==deliveryFingerprint())return;
 if(error||!data?.available||!Number.isSafeInteger(data.delivery_cents))throw Error('Cotação indisponível');
 deliveryQuote=data;deliveryQuoteKey=key;
 const subtotal=cart().reduce((sum,i)=>sum+(state.products.find(p=>p.id===i.product_id)?.price_cents||0)*i.quantity,0);
 status.textContent='Frete calculado automaticamente • '+(data.distance_m/1000).toFixed(2).replace('.',',')+' km';
 if(value)value.textContent=money(data.delivery_cents);
 if(grand)grand.textContent=money(subtotal+data.delivery_cents);
 if(actions)actions.querySelectorAll('button').forEach(b=>b.disabled=false);
 }catch{if(seq!==deliverySeq)return;status.textContent='Não foi possível calcular o frete. Confira seu endereço e tente atualizar a página.';if(value)value.textContent='Indisponível';}
}

const renderers={home,tutor,booking,cart:checkout,store:storePage,vet:vetPage,courier:courierPage,admin:adminPage,hotel:()=>specialtyPage('hotel'),walkers:()=>specialtyPage('walkers'),pharmacy:()=>specialtyPage('pharmacy')};
async function render() {
 const token=++rendering;
 try {
  const body=await renderers[page]();if(token!==rendering)return;
  shell(page,body,state.user?state.profile?.full_name||'Sua conta conectada':'Mundo Pet');
  if(page==='cart')void updateDeliveryQuote();
  if(page==='home'){updateCatalog(filter,search);const input=document.getElementById('mp-search');input.value=search;if(new URLSearchParams(location.search).has('explore'))document.getElementById('mp-catalog')?.scrollIntoView({block:'start'});}
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
async function refresh() {await Promise.all([loadPublic(),loadUser()]);await render();}
function requireLogin() {if(state.user)return true;authModal();return false;}
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
 modal(id?'Editar serviço':'Novo serviço',`<form id="mp-service-form" class="mp-stack" data-id="${esc(id||'')}">${field('name','Nome do serviço',s.name,'text','required maxlength="150"')}${field('provider_name','Nome profissional / clínica',s.provider_name||state.profile?.full_name,'text','required maxlength="120"')}${select('category','Categoria',[['Veterinários','Veterinários'],['Banho & Tosa','Banho & Tosa'],['Hospedagem','Hospedagem'],['Dog Walkers','Dog Walkers'],['Farmácia','Farmácia']],s.category||'Veterinários')}<div class="mp-grid">${field('price','Valor (R$)',s.price_cents?(s.price_cents/100).toFixed(2):'','number','required min="0.01" max="100000" step="0.01"')}${field('duration','Duração (minutos)',s.duration_minutes||60,'number','required min="15" max="480" step="15"')}</div>${field('service_photo','Foto do serviço do dispositivo','','file','accept="image/jpeg,image/png,image/webp"')}${s.image_url?'<p class="mp-muted">Foto atual preservada até escolher outra.</p>':''}<p class="mp-muted">Novos serviços são salvos como inativos. Atendimentos comerciais só serão habilitados após concluir a configuração de operação e pagamento.</p><button class="mp-btn" type="submit">Salvar serviço</button></form>`);
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
const actions={
 'scan-product-code':scanProductCode,
 'lookup-product-code':el=>lookupProductBarcode(document.getElementById('mp-product-form')?.elements.namedItem('ean')?.value),
 'stop-product-scan':stopProductScan,
 home:()=>{location.href=route.home;},account:accountModal,login:()=>authModal(),signup:()=>authModal('signup'),recover:()=>authModal('recover'),'close-modal':closeModal,
 logout:async()=>{await result(db.auth.signOut());state.user=null;await loadUser();closeModal();await render();toast('Você saiu da conta.');},
 refresh:async()=>{await refresh();toast('Dados atualizados.');},
 apply:el=>applicationModal(el.dataset.role||'store'),
 'edit-address':()=>{if(requireLogin())location.href=route.tutor;},
 'add-cart':async el=>{const p=state.products.find(p=>p.id===el.dataset.id);if(!p||p.stock<1)throw new Error('Produto indisponível.');const items=cart();const other=items.map(i=>state.products.find(p=>p.id===i.product_id)).some(x=>x&&x.store_id!==p.store_id);if(other)throw new Error('Finalize o carrinho da outra loja antes de adicionar este produto.');const old=items.find(i=>i.product_id===p.id);if(old){if(old.quantity>=Math.min(p.stock,99))throw new Error('Limite de estoque atingido.');old.quantity++;}else items.push({product_id:p.id,quantity:1});saveCart(items);await render();toast('Produto adicionado ao carrinho.');},
 favorite:async el=>{toggleFavorite(el.dataset.id);updateCatalog(filter,search);toast('Favoritos atualizados.');},
 filter:el=>{filter=el.dataset.filter;document.querySelectorAll('.mp-category').forEach(n=>n.classList.toggle('active',n.dataset.filter===filter));updateCatalog(filter,search);document.getElementById('mp-catalog')?.scrollIntoView({behavior:'smooth',block:'start'});},
 'clear-filter':()=>{filter='';search='';if(document.getElementById('mp-search'))document.getElementById('mp-search').value='';document.querySelectorAll('.mp-category').forEach(n=>n.classList.remove('active'));updateCatalog();},
 explore:()=>{document.getElementById('mp-catalog')?.scrollIntoView({behavior:'smooth',block:'start'});document.getElementById('mp-search')?.focus();},
 'book-service':el=>{sessionStorage.setItem('mundopet.service',el.dataset.id);location.href=route.booking;},
 'edit-pet':el=>{const p=state.pets.find(p=>p.id===el.dataset.id);modal('Editar pet',petEditor(p));},
 'cart-quantity':async el=>{const items=cart();const item=items.find(i=>i.product_id===el.dataset.id);if(!item)return;const qty=item.quantity+Number(el.dataset.change);const p=state.products.find(p=>p.id===item.product_id);if(qty>Math.min(p?.stock||0,99))throw new Error('Quantidade maior que o estoque disponível.');item.quantity=qty;saveCart(items);await render();},
 'remove-cart':async el=>{saveCart(cart().filter(i=>i.product_id!==el.dataset.id));await render();},
 checkout:async(el)=>{if(!requireLogin())return;const a=state.profile?.address;if(!a?.street||!a.number||!a.city||!a.state)throw new Error('Complete o endereço no perfil.');const items=cart();if(!items.length)throw new Error('Seu carrinho está vazio.');if(!deliveryQuote||deliveryQuoteKey!==deliveryFingerprint())throw new Error('Aguarde o cálculo automático do frete antes de pagar.');const method=el.dataset.method;if(!['infinitepay_pix','infinitepay_card'].includes(method))throw new Error('Selecione Pix ou cartão.');const {data,error}=await db.functions.invoke('mp-secure-checkout',{body:{cart:items,request_id:orderRequestKey(),payment_method:method}});if(error||!data?.url)throw new Error('Pagamento indisponível. Confira endereço e estoque e tente novamente.');const url=new URL(data.url);if(url.protocol!=='https:'||!(url.hostname==='infinitepay.io'||url.hostname.endsWith('.infinitepay.io')))throw new Error('Link de pagamento inválido.');location.assign(url.href);},
 'order-status':el=>orderStatus(el.dataset.id,el.dataset.status),
 'order-details':el=>orderDetails(el.dataset.id),
 'print-order':()=>{if(!activeOrder)return;const o=activeOrder;const w=window.open('','_blank');if(!w)throw new Error('Permita abrir a janela de impressão no navegador.');w.document.write(`<!doctype html><html lang="pt-BR"><head><title>Pedido Mundo Pet</title><style>body{font:16px system-ui;padding:28px;max-width:700px}h1{color:#006c49}li{margin:10px 0}</style></head><body><h1>Mundo Pet</h1><h2>Pedido #${o.id.slice(0,8)}</h2><p>${o.is_demo?'DEMONSTRAÇÃO — SEM COBRANÇA':'Comprovante do pedido'}</p><p>${dateTime(o.created_at)}</p><ul>${o.mp_order_items.map(i=>`<li>${i.quantity}× ${esc(i.name)} • ${money(i.unit_cents*i.quantity)}</li>`).join('')}</ul>${o.discount_cents?`<p>Desconto do cupom: − ${money(o.discount_cents)}</p>`:''}<strong>Total: ${money(o.total_cents)}</strong><p>Pagamento: ${o.payment_status==='paid'?'confirmado':'não recebido'}</p><p>Entrega: ${esc(o.address.street)}, ${esc(o.address.number)} • ${esc(o.address.city)}</p><button onclick="window.print()">Imprimir</button></body></html>`);w.document.close();},
 'toggle-store':async el=>{const s=state.stores.find(s=>s.id===el.dataset.id);await result(db.from('mp_stores').update({is_open:!s.is_open}).eq('id',s.id));await refresh();toast('Disponibilidade da loja atualizada.');},
 'store-filter':el=>{document.querySelectorAll('[data-order-status]').forEach(n=>n.hidden=el.dataset.filter!=='all'&&n.dataset.orderStatus!==el.dataset.filter);},
 'review-product':async el=>{if(!state.roles.includes('admin'))throw new Error('Acesso restrito.');await result(db.from('mp_products').update({approval_status:el.dataset.status,active:el.dataset.status==='approved'}).eq('id',el.dataset.id));await refresh();toast('Solicitação de produto analisada.');},
 'adopt-catalog':el=>{modal('Adicionar produto à loja',`<form id="mp-adopt-catalog-form" data-id="${esc(el.dataset.id)}" data-store="${esc(el.dataset.store)}" class="mp-stack">${field('price','Seu preço de venda (R$)','','number','required min="0.01" step="0.01"')}${field('stock','Quantidade em estoque',0,'number','required min="0" step="1"')}<button class="mp-btn" type="submit">Adicionar produto</button></form>`);},
 'admin-new-product':()=>adminNewProduct(),
 'admin-new-store':()=>adminNewStore(),
 'admin-pick-store':el=>productModal('',el.dataset.id),
 'product-editor':el=>productModal(el.dataset.id,el.dataset.store),
 'toggle-product':async el=>{if(!state.roles.includes('admin'))throw new Error('Ativação depende da aprovação do administrador.');await result(db.from('mp_products').update({active:el.dataset.active==='true'}).eq('id',el.dataset.id));await refresh();toast('Produto atualizado.');},
 'toggle-online':async()=>{if(!state.profile){await result(db.from('mp_profiles').insert({user_id:state.user.id,full_name:state.user.email,online:true}));}else await result(db.from('mp_profiles').update({online:!state.profile.online}).eq('user_id',state.user.id));await refresh();},
 'quote-shipping':async()=>{if(!requireLogin())return;const items=cart();if(!items.length)throw new Error('Adicione produtos ao carrinho.');const product=state.products.find(p=>p.id===items[0].product_id);if(!product)throw new Error('Produto indisponível.');const el=document.getElementById('mp-delivery-quote-result');if(el)el.textContent='Calculando distância da loja até seu endereço…';const {data,error}=await db.functions.invoke('mp-delivery-quote',{body:{store_id:product.store_id}});if(error){if(el)el.textContent='Não foi possível calcular o frete. Verifique o endereço e tente novamente.';throw new Error('Frete indisponível no momento.');}if(!data?.available){if(el)el.textContent='Entrega indisponível. Confira o endereço e a configuração de rotas.';return;}if(el)el.textContent='Frete estimado: '+money(data.delivery_cents)+' • '+(data.distance_m/1000).toFixed(2).replace('.',',')+' km pela rota. Valor sujeito à confirmação no checkout.';},
 'map-route':async el=>{const o=await result(db.from('mp_orders').select('address').eq('id',el.dataset.id).single());const a=o.address;const dest=[a.street,a.number,a.city,a.state].filter(Boolean).join(', ');window.open('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(dest),'_blank','noopener,noreferrer');},
 'appointment-status':async el=>{await result(db.rpc('mp_transition_appointment',{aid:el.dataset.id,next_status:el.dataset.status}));await refresh();toast('Agendamento atualizado.');},
 clinical:el=>clinicalModal(el.dataset.id),
 'service-editor':el=>serviceModal(el.dataset.id),
 'toggle-service':async el=>{if(!can('admin'))throw new Error('A publicação depende da aprovação do administrador.');await result(db.rpc('mp_review_service',{p_service:el.dataset.id,p_approve:el.dataset.active==='true'}));await refresh();toast('Serviço atualizado.');},
 'review-service':async el=>{if(!can('admin'))throw new Error('Acesso restrito.');await result(db.rpc('mp_review_service',{p_service:el.dataset.id,p_approve:el.dataset.approved==='true'}));await refresh();toast('Serviço analisado.');},
 'review-application':async el=>{await result(db.rpc('mp_review_application',{aid:el.dataset.id,approved:el.dataset.approved==='true'}));await refresh();toast('Solicitação analisada.');},
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
 'mp-service-form':async(form,v)=>{const existing=form.dataset.id?await result(db.from('mp_services').select('image_url').eq('id',form.dataset.id).single()):{};const image=await uploadImage(form,'service_photo');const payload={provider_id:state.user.id,name:v.name.trim(),provider_name:v.provider_name.trim(),category:v.category,price_cents:Math.round(Number(v.price)*100),duration_minutes:Number(v.duration),image_url:image||existing.image_url||''};await result(form.dataset.id?db.from('mp_services').update(payload).eq('id',form.dataset.id):db.from('mp_services').insert({...payload,active:false}));await refresh();toast('Serviço salvo.');},
 'mp-message-form':async(form,v)=>{await result(db.from('mp_messages').insert({order_id:form.dataset.id,sender_id:state.user.id,body:v.body.trim()}));await orderDetails(form.dataset.id);toast('Mensagem enviada no pedido.');},
 'mp-clinical-form':async(form,v)=>{await result(db.from('mp_clinical_notes').insert({appointment_id:form.dataset.id,provider_id:state.user.id,body:v.body.trim()}));await clinicalModal(form.dataset.id);toast('Anotação salva.');},
};
document.addEventListener('submit',async event=>{const form=event.target;const handler=form.classList.contains('mp-delivery-form')?(f,v)=>orderStatus(f.dataset.id,'delivered',v.code):forms[form.id];if(!handler)return;event.preventDefault();const button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;try{await handler(form,formObject(form));}catch(error){const errorBox=form.querySelector('.mp-error');if(errorBox)errorBox.textContent=friendly(error);else toast(friendly(error),true);}finally{if(button.isConnected)button.disabled=false;}});
document.addEventListener('input',event=>{if(event.target.id==='mp-search'){search=event.target.value;updateCatalog(filter,search);}});
document.addEventListener('change',event=>{
 if(event.target.id==='mp-show-password'){const input=document.querySelector('#mp-auth-form [name="password"]');input.type=event.target.checked?'text':'password';}
 if(event.target.closest('#mp-booking-form')){const form=document.getElementById('mp-booking-form');const v=formObject(form);const price=state.services.find(s=>s.id===v.service)?.price_cents||0;const total=document.getElementById('mp-booking-total');if(total)total.textContent=money(price+({home:3000,taxi:4000}[v.mode]||0));}
});

// Render the approved storefront immediately. Network requests must never block the Home.
const withDeadline=(operation,ms=9000)=>Promise.race([
 Promise.resolve().then(operation),
 new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo limite de conexão excedido. Confira a conexão e tente novamente.')),ms))
]);
async function init(){
 await render();
 const {data:{session},error}=await withDeadline(()=>db.auth.getSession());if(error)throw error;state.user=session?.user||null;
 await withDeadline(()=>Promise.all([loadPublic(),loadUser()]));await render();
 const authParams=new URLSearchParams(location.search);
 if(authParams.has('recovery')&&state.user)newPasswordModal();
 else if(authParams.has('login')){if(!state.user)authModal();else toast('E-mail confirmado. Sua conta está conectada.');}
 const callbackError=new URLSearchParams(location.hash.slice(1)).get('error_description')||authParams.get('error_description');
 if(callbackError)toast('Link inválido ou expirado. Use Esqueci minha senha para solicitar outro.',true);
}
db.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY'){state.user=session?.user||null;setTimeout(newPasswordModal,0);}
 if(event==='TOKEN_REFRESHED')state.user=session?.user||null;
 if(event==='SIGNED_OUT'){state.user=null;setTimeout(()=>{loadUser().then(render);},0);}
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
if(['store','vet','courier','admin'].includes(page))setInterval(()=>{
 if(!state.user||document.hidden||document.querySelector('[role="dialog"]')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 refresh().catch(error=>toast(friendly(error),true));
},15000);
