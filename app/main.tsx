import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const platform = window.location.protocol === "capacitor:" ? "native" : "web";
document.documentElement.dataset.platform = platform;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
