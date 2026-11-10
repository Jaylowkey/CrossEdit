"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("crossEdit", {
    openPdf: () => electron_1.ipcRenderer.invoke("pdf:open"),
    openMultiplePdfs: () => electron_1.ipcRenderer.invoke("pdf:open-multiple"),
    savePdfAs: (payload) => electron_1.ipcRenderer.invoke("pdf:save-as", payload),
    getVersion: () => electron_1.ipcRenderer.invoke("app:version"),
    showInFolder: (filePath) => electron_1.ipcRenderer.invoke("app:show-in-folder", filePath),
    checkForUpdates: () => electron_1.ipcRenderer.invoke("app:update-check"),
    downloadUpdate: () => electron_1.ipcRenderer.invoke("app:update-download"),
    installUpdate: () => electron_1.ipcRenderer.invoke("app:update-install"),
    onUpdateStatus: (callback) => {
        const listener = (_event, payload) => callback(payload);
        electron_1.ipcRenderer.on("app:update-status", listener);
        return () => electron_1.ipcRenderer.removeListener("app:update-status", listener);
    }
});
