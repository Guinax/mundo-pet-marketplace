import React from "react";
import { createRoot } from "react-dom/client";

// Keep the approved Stitch HTML isolated so its Tailwind theme and fonts
// render faithfully while the application retains its React/Vite entry point.
function App() {
  return <iframe title="Mundo Pet — marketplace" src="/stitch-home.html"
    style={{ display: "block", width: "100%", height: "100dvh", border: 0 }} />;
}
createRoot(document.getElementById("root")).render(<App />);
