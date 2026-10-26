import {adminLayout,adminDashboard,bindAdminFilters} from './admin-design.js';
// Isolated design preview. This entry has no database/authentication imports and no mutations.
const applications=[
 {id:'sample-shop',role:'store',status:'pending',name:'Pet Shop Bicho Mimado',badge:'CNPJ OK',description:'Resp.: Luciana M. • São Paulo - SP',note:'Alvará Sanitário · Fachada Anexa'},
 {id:'sample-vet',role:'vet',status:'pending',name:'Dr. Felipe Nogueira',badge:'CRMV Ativo',description:'CRMV-SP 42.109 • Clínica & Dermatologia',note:'Teleorientação Habilitada'},
 {id:'sample-courier',role:'courier',status:'pending',name:'Mateus Prado',badge:'CNH A',description:'Honda Fan 160 • Placa: FXT-9021',note:'Antecedentes Criminais Limpos'},
];
const orders=[
 {id:'sample-9102',shortId:'9102',status:'delivering',statusLabel:'Em Trânsito',storeName:'Petz Jardins',title:'Mariana S. (Thor - Golden)',detail:'Piloto: Carlos S. (Restam ~8 min)',total_cents:34990,commissionLabel:'Comissão: R$ 52,48 (15%)'},
 {id:'sample-9098',shortId:'9098',status:'confirmed',statusLabel:'Atendimento Iniciado',storeName:'VetCare Jardins',title:'Consulta Clínica (Dra. Camila Santos)',detail:'Paciente: Thor (Check-up anual)',total_cents:20500,commissionLabel:'Comissão: R$ 30,75 (15%)'},
 {id:'sample-9095',shortId:'9095',status:'ready',statusLabel:'Alocando Motoboy',storeName:'Cobasi Moema',title:'Ração Premium & Acessórios',detail:'Tentando piloto no raio de 3km...',total_cents:18785,commissionLabel:'Comissão: R$ 28,17 (15%)'},
];
const summary={gross:8492000,commission:1273800,completedToday:342,active:Array(24),partners:'1.240',couriers:[],period:'Hoje, Março 2025'};
const fleet=[{name:'Carlos Silva',detail:'Em Rota p/ Av. Paulista • 8 corridas hoje',online:true,rating:'4.96'},{name:'Lucas Mendes',detail:'Livre em Pinheiros • 6 corridas hoje',online:true,rating:'4.91'},{name:'Rafael Costa',detail:'Offline • Última corrida há 1h20',online:false}];
document.body.classList.add('ad-preview-page');
document.body.innerHTML=adminLayout(adminDashboard({demo:true,summary,applications,orders,fleet}),{demo:true,name:'Ricardo Alencar',pending:7});
bindAdminFilters();
let toastTimer;
document.addEventListener('click',event=>{const target=event.target.closest('[data-demo-action]');if(!target)return;document.querySelector('.ad-demo-toast')?.remove();const notice=document.createElement('div');notice.className='ad-demo-toast';notice.setAttribute('role','status');notice.textContent='Prévia visual: esta ação não altera cadastros, campanhas ou pagamentos.';document.body.append(notice);clearTimeout(toastTimer);toastTimer=setTimeout(()=>notice.remove(),4000);});
document.querySelectorAll('.ad-nav a').forEach(link=>link.addEventListener('click',()=>{document.querySelectorAll('.ad-nav a').forEach(x=>{x.classList.toggle('active',x===link);if(x===link)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current');});if(link.hash==='#ad-settings')document.querySelector('#ad-marketing').scrollIntoView({block:'start'});}));
