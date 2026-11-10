"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const promises_1 = require("node:fs/promises");
const electron_updater_1 = require("electron-updater");
const node_path_1 = __importDefault(require("node:path"));
let mainWindow = null;
let updaterConfigured = false;
function sendUpdateStatus(status, detail) {
    mainWindow?.webContents.send("app:update-status", { status, detail });
}
async function configureUpdater() {
    if (!electron_1.app.isPackaged)
        return;
    try {
        await (0, promises_1.access)(node_path_1.default.join(process.resourcesPath, "app-update.yml"));
        updaterConfigured = true;
        electron_updater_1.autoUpdater.autoDownload = false;
        electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
        electron_updater_1.autoUpdater.on("checking-for-update", () => sendUpdateStatus("checking"));
        electron_updater_1.autoUpdater.on("update-available", info => sendUpdateStatus("available", info.version));
        electron_updater_1.autoUpdater.on("update-not-available", () => sendUpdateStatus("current"));
        electron_updater_1.autoUpdater.on("download-progress", progress => sendUpdateStatus("downloading", `${Math.round(progress.percent)}%`));
        electron_updater_1.autoUpdater.on("update-downloaded", info => sendUpdateStatus("downloaded", info.version));
        electron_updater_1.autoUpdater.on("error", error => sendUpdateStatus("error", error.message));
        // Verificação inicial silenciosa: a aplicação continua utilizável offline.
        await electron_updater_1.autoUpdater.checkForUpdates().catch(error => sendUpdateStatus("error", error.message));
    }
    catch {
        // Sem app-update.yml significa que o repositório de releases ainda não foi configurado.
        sendUpdateStatus("unconfigured");
    }
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1440, height: 920, minWidth: 1000, minHeight: 680,
        backgroundColor: "#10131b", title: "CrossEdit", icon: node_path_1.default.join(__dirname, "../build/crossedit.ico"),
        webPreferences: { preload: node_path_1.default.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    if (!electron_1.app.isPackaged)
        void mainWindow.loadURL("http://localhost:5173");
    else
        void mainWindow.loadFile(node_path_1.default.join(__dirname, "../dist/index.html"));
}
async function readSelected(filePath) {
    const bytes = await (0, promises_1.readFile)(filePath);
    return { name: node_path_1.default.basename(filePath), path: filePath, data: new Uint8Array(bytes) };
}
electron_1.ipcMain.handle("pdf:open", async () => {
    const result = await electron_1.dialog.showOpenDialog({ title: "Abrir PDF", properties: ["openFile"], filters: [{ name: "Documentos PDF", extensions: ["pdf"] }] });
    if (result.canceled || !result.filePaths[0])
        return null;
    return readSelected(result.filePaths[0]);
});
electron_1.ipcMain.handle("pdf:open-multiple", async () => {
    const result = await electron_1.dialog.showOpenDialog({ title: "Selecionar PDFs para juntar", properties: ["openFile", "multiSelections"], filters: [{ name: "Documentos PDF", extensions: ["pdf"] }] });
    if (result.canceled)
        return null;
    return Promise.all(result.filePaths.map(readSelected));
});
electron_1.ipcMain.handle("pdf:save-as", async (_event, payload) => {
    const result = await electron_1.dialog.showSaveDialog({ title: "Guardar PDF", defaultPath: payload.name || "documento.pdf", filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (result.canceled || !result.filePath)
        return { canceled: true };
    await (0, promises_1.writeFile)(result.filePath, Buffer.from(payload.data));
    return { canceled: false, path: result.filePath };
});
electron_1.ipcMain.handle("app:version", () => electron_1.app.getVersion());
electron_1.ipcMain.handle("app:update-check", async () => {
    if (!updaterConfigured)
        return { status: "unconfigured" };
    try {
        await electron_updater_1.autoUpdater.checkForUpdates();
        return { status: "checking" };
    }
    catch (error) {
        return { status: "error", detail: error instanceof Error ? error.message : String(error) };
    }
});
electron_1.ipcMain.handle("app:update-download", async () => {
    if (!updaterConfigured)
        return { status: "unconfigured" };
    try {
        await electron_updater_1.autoUpdater.downloadUpdate();
        return { status: "downloading" };
    }
    catch (error) {
        return { status: "error", detail: error instanceof Error ? error.message : String(error) };
    }
});
electron_1.ipcMain.handle("app:update-install", () => { if (updaterConfigured)
    electron_updater_1.autoUpdater.quitAndInstall(); });
electron_1.ipcMain.handle("app:show-in-folder", (_event, filePath) => electron_1.shell.showItemInFolder(filePath));
electron_1.app.whenReady().then(() => { createWindow(); void configureUpdater(); electron_1.app.on("activate", () => { if (electron_1.BrowserWindow.getAllWindows().length === 0)
    createWindow(); }); });
electron_1.app.on("window-all-closed", () => { if (process.platform !== "darwin")
    electron_1.app.quit(); });
