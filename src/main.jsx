import React from "react";
import { createRoot } from "react-dom/client";

const pages = [
  ["Início", "Vitrine e busca de produtos e serviços"],
  ["Tutor e pets", "Cadastro e informações dos animais"],
  ["Agendamentos", "Serviços, datas e profissionais"],
  ["Carrinho e pedidos", "Checkout e acompanhamento"],
  ["Pet shop", "Painel do lojista"],
  ["Veterinário", "Agenda e atendimentos"],
  ["Entregador", "Corridas e entregas"],
  ["Administração", "Gestão geral do marketplace"]
];
function App() {
  return <main style={{fontFamily:"system-ui,sans-serif",background:"#f3f8f6",minHeight:"100vh",color:"#173d37"}}>
    <header style={{background:"#11675c",color:"white",padding:"28px 6vw"}}>
      <h1 style={{margin:0}}>🐾 Mundo Pet Marketplace</h1>
      <p>Base navegável do projeto — sem operações reais habilitadas.</p>
    </header>
    <section style={{maxWidth:1050,margin:"0 auto",padding:"32px 20px"}}>
      <h2>Áreas do marketplace</h2>
      <p>As telas originais do Google Stitch ainda estão em importação. Esta navegação inicial mantém o projeto React abrindo enquanto a migração visual é feita.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:16}}>
        {pages.map(([title,desc],idx)=><article key={title} style={{background:"white",borderRadius:16,padding:20,boxShadow:"0 3px 14px #134a3a15",border:"1px solid #dbe8e3"}}>
          <div style={{fontSize:28}}>{["🏠","🐕","📅","🛒","🏪","🩺","🛵","⚙️"][idx]}</div>
          <h3>{title}</h3><p>{desc}</p>
          <span style={{fontSize:13,color:"#906614"}}>Layout pendente de integração</span>
        </article>)}
      </div>
      <p style={{marginTop:28,fontSize:13}}>Protótipo visual. Nenhuma compra, cadastro ou agendamento é processado.</p>
    </section>
  </main>;
}
createRoot(document.getElementById("root")).render(<App />);
