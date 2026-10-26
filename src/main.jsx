import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const appIsInstalled = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

function App() {
  const deferredPrompt = useRef(null);
  const [installed, setInstalled] = useState(appIsInstalled);
  const [dismissed, setDismissed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("PWA registration:", error)), { once: true });
      if (document.readyState === "complete") navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("PWA registration:", error));
    }
    const handlePrompt = (event) => {
      event.preventDefault();
      deferredPrompt.current = event;
    };
    const handleInstalled = () => {
      deferredPrompt.current = null;
      setInstalled(true);
      setHelpOpen(false);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const modeChange = () => setInstalled(appIsInstalled());
    displayMode.addEventListener?.("change", modeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      displayMode.removeEventListener?.("change", modeChange);
    };
  }, []);

  async function installApp() {
    const prompt = deferredPrompt.current;
    if (!prompt) {
      setHelpOpen(true);
      return;
    }
    deferredPrompt.current = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === "accepted") setDismissed(true);
      else setHelpOpen(true);
    } catch {
      setHelpOpen(true);
    }
  }

  return <>
    <iframe allow="web-share; clipboard-write" title="Mundo Pet — marketplace"
      src={`/stitch-home.html${window.location.search}${window.location.hash}`}
      style={{ display: "block", width: "100%", height: "100dvh", border: 0 }} />
    {!installed && !dismissed && <div role="group" aria-label="Instalação do Mundo Pet"
      style={{ position:"fixed", right:14, bottom:"calc(96px + env(safe-area-inset-bottom, 0px))", zIndex:99,
        display:"flex", alignItems:"center", gap:6, padding:6, background:"#006947", color:"#fff", borderRadius:40,
        boxShadow:"0 4px 18px #00382466", fontFamily:"Inter,system-ui,sans-serif" }}>
      <button type="button" onClick={installApp} aria-label="Instalar aplicativo Mundo Pet"
        style={{ border:0, background:"transparent", color:"#fff", fontWeight:700, padding:"8px 7px 8px 12px",
          cursor:"pointer", fontSize:13 }}>↓ Instalar app</button>
      <button type="button" aria-label="Ocultar opção de instalação" onClick={() => setDismissed(true)}
        style={{ border:0, color:"#fff", background:"#ffffff29", borderRadius:"50%", width:29, height:29,
          fontSize:19, cursor:"pointer" }}>×</button>
    </div>}
    {helpOpen && <div role="presentation" onClick={() => setHelpOpen(false)}
      style={{ position:"fixed", inset:0, zIndex:120, background:"#0009", display:"grid", placeItems:"center", padding:20 }}>
      <section role="dialog" aria-modal="true" aria-label="Instalar Mundo Pet"
        onClick={event => event.stopPropagation()}
        style={{ maxWidth:380, background:"#fff", color:"#14231e", padding:22, borderRadius:18,
          fontFamily:"Inter,system-ui,sans-serif", boxShadow:"0 12px 32px #0003" }}>
        <h2 style={{ margin:"0 0 12px", fontSize:21 }}>Instalar Mundo Pet</h2>
        <p style={{ lineHeight:1.6, fontSize:14 }}>No Android, abra esta página no <b>Chrome</b>, toque no menu <b>⋮</b> e escolha <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>.</p>
        <p style={{ lineHeight:1.6, fontSize:14 }}>No iPhone, abra no <b>Safari</b>, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p>
        <button type="button" onClick={() => setHelpOpen(false)}
          style={{ display:"block", width:"100%", padding:12, border:0, borderRadius:9,
            color:"#fff", background:"#006947", fontWeight:700, cursor:"pointer" }}>Entendi</button>
      </section>
    </div>}
  </>;
}

createRoot(document.getElementById("root")).render(<App />);
