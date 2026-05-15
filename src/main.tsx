import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { App } from "@/App";
import { LanguageProvider } from "@/components/shared/language-provider";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import "@/index.css";

const Router = window.desktopShell ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <Router>
          <App />
        </Router>
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
