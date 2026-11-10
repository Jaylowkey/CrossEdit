import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { readFile, writeFile, access } from "node:fs/promises";
import { autoUpdater } from "electron-updater";
import path from "node:path";

let mainWindow: BrowserWindow | null = null;
let updaterConfigured = false;

function sendUpdateStatus(status: string, detail?: string) {
  mainWindow?.webContents.send("app:update-status", { status, detail });
}

async function configureUpdater() {
  if (!app.isPackaged) return;
  try {
    await access(path.join(process.resourcesPath, "app-update.yml"));
    updaterConfigured = true;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("checking-for-update", () => sendUpdateStatus("checking"));
    autoUpdater.on("update-available", info => sendUpdateStatus("available", info.version));
    autoUpdater.on("update-not-available", () => sendUpdateStatus("current"));
    autoUpdater.on("download-progress", progress => sendUpdateStatus("downloading", `${Math.round(progress.percent)}%`));
    autoUpdater.on("update-downloaded", info => sendUpdateStatus("downloaded", info.version));
    autoUpdater.on("error", error => sendUpdateStatus("error", error.message));
    // Verificação inicial silenciosa: a aplicação continua utilizável offline.
    await autoUpdater.checkForUpdates().catch(error => sendUpdateStatus("error", error.message));
  } catch {
    // Sem app-update.yml significa que o repositório de releases ainda não foi configurado.
    sendUpdateStatus("unconfigured");
  }
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1000, minHeight: 680,
    backgroundColor: "#10131b", title: "CrossEdit", icon: path.join(__dirname, "../build/crossedit.ico"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  if (!app.isPackaged) void mainWindow.loadURL("http://localhost:5173");
  else void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
}
async function readSelected(filePath: string) {
  const bytes = await readFile(filePath);
  return { name: path.basename(filePath), path: filePath, data: new Uint8Array(bytes) };
}
ipcMain.handle("pdf:open", async () => {
  const result = await dialog.showOpenDialog({ title: "Abrir PDF", properties: ["openFile"], filters: [{ name: "Documentos PDF", extensions: ["pdf"] }] });
  if (result.canceled || !result.filePaths[0]) return null;
  return readSelected(result.filePaths[0]);
});
ipcMain.handle("pdf:open-multiple", async () => {
  const result = await dialog.showOpenDialog({ title: "Selecionar PDFs para juntar", properties: ["openFile", "multiSelections"], filters: [{ name: "Documentos PDF", extensions: ["pdf"] }] });
  if (result.canceled) return null;
  return Promise.all(result.filePaths.map(readSelected));
});
ipcMain.handle("pdf:save-as", async (_event, payload: { name: string; data: Uint8Array }) => {
  const result = await dialog.showSaveDialog({ title: "Guardar PDF", defaultPath: payload.name || "documento.pdf", filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (result.canceled || !result.filePath) return { canceled: true };
  await writeFile(result.filePath, Buffer.from(payload.data));
  return { canceled: false, path: result.filePath };
});
ipcMain.handle("app:version", () => app.getVersion());
ipcMain.handle("app:update-check", async () => {
  if (!updaterConfigured) return { status: "unconfigured" };
  try { await autoUpdater.checkForUpdates(); return { status: "checking" }; }
  catch (error) { return { status: "error", detail: error instanceof Error ? error.message : String(error) }; }
});
ipcMain.handle("app:update-download", async () => {
  if (!updaterConfigured) return { status: "unconfigured" };
  try { await autoUpdater.downloadUpdate(); return { status: "downloading" }; }
  catch (error) { return { status: "error", detail: error instanceof Error ? error.message : String(error) }; }
});
ipcMain.handle("app:update-install", () => { if (updaterConfigured) autoUpdater.quitAndInstall(); });
ipcMain.handle("app:show-in-folder", (_event, filePath: string) => shell.showItemInFolder(filePath));
app.whenReady().then(() => { createWindow(); void configureUpdater(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });