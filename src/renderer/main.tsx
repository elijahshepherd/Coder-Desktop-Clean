import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { desktopApi } from "./api/desktopApi";
import "./styles.css";

window.addEventListener("error", (event) => {
  void desktopApi.reportBug({
    area: "renderer",
    title: "Renderer error",
    message: event.message,
    severity: "high",
    stack: event.error instanceof Error ? event.error.stack : undefined,
    metadata: {
      filename: event.filename,
      line: event.lineno,
      column: event.colno
    }
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
  void desktopApi.reportBug({
    area: "renderer",
    title: "Unhandled renderer promise",
    message: error.message,
    severity: "high",
    stack: error.stack
  });
});

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
