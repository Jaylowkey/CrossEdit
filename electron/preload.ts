import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("crossEdit", {
  openPdf: () => ipcRenderer.invoke("pdf:open"),
  openMultiplePdfs: () => ipcRenderer.invoke("pdf:open-multiple"),
  savePdfAs: (payload: { name: string; data: Uint8Array }) => ipcRenderer.invoke("pdf:save-as", payload),
  getVersion: () => ipcRenderer.invoke("app:version") as Promise<string>,
  showInFolder: (filePath: string) => ipcRenderer.invoke("app:show-in-folder", filePath),
  checkForUpdates: () => ipcRenderer.invoke("app:update-check"),
  downloadUpdate: () => ipcRenderer.invoke("app:update-download"),
  installUpdate: () => ipcRenderer.invoke("app:update-install"),
  onUpdateStatus: (callback: (payload: { status: string; detail?: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { status: string; detail?: string }) => callback(payload);
    ipcRenderer.on("app:update-status", listener);
    return () => ipcRenderer.removeListener("app:update-status", listener);
  }
});