export {};
declare global {
  interface Window {
    crossEdit: {
      openPdf: () => Promise<{ name: string; path: string; data: Uint8Array } | null>;
      openMultiplePdfs: () => Promise<Array<{ name: string; path: string; data: Uint8Array }> | null>;
      savePdfAs: (payload: { name: string; data: Uint8Array }) => Promise<{ canceled: boolean; path?: string }>;
      getVersion: () => Promise<string>;
      showInFolder: (filePath: string) => Promise<void>;
      checkForUpdates: () => Promise<{ status: string; detail?: string }>;
      downloadUpdate: () => Promise<{ status: string; detail?: string }>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (callback: (payload: { status: string; detail?: string }) => void) => () => void;
    };
  }
}