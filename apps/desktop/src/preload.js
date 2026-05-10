// Thin preload — only expose minimal OS bridges, not business logic.
// Business logic flows through WebSocket (localhost:8765).

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("labelitDesktop", {
  /** True when running inside Electron */
  isDesktop: true,

  /** Platform identifier */
  platform: process.platform,
});
