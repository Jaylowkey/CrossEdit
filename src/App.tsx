import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, ChangeEvent } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import {
  FolderOpen, Save, Undo2, Redo2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  RotateCw, Download, FileText, PanelsTopLeft, MousePointer2, Type, Image as ImageIcon,
  Highlighter, PenLine, Square, ShieldCheck, Scissors, Files, Minimize2, ScanText,
  Menu, X, Trash2, Copy, ArrowUp, ArrowDown, Merge, Signature, FilePlus2, RefreshCw, DownloadCloud
} from "lucide-react";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type PdfFile = { name: string; path: string; data: Uint8Array };
type Tool = "select" | "text" | "highlight" | "draw" | "shape" | "signature";
type Snapshot = { data: Uint8Array; name: string };

export default function App() {
  const [file, setFile] = useState<PdfFile | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [sidebar, setSidebar] = useState(true);
  const [notice, setNotice] = useState("Pronto para editar");
  const [appVersion, setAppVersion] = useState("0.3.0");
  const [updateStatus, setUpdateStatus] = useState("idle");
  const [updateDetail, setUpdateDetail] = useState("");
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedImage, setSelectedImage] = useState<Uint8Array | null>(null);
  const [imageType, setImageType] = useState<"png" | "jpg">("png");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const thumbRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  const loadBytes = useCallback(async (data: Uint8Array, name: string, path = "") => {
    const bytes = new Uint8Array(data);
    const loaded = await getDocument({ data: bytes.slice() }).promise;
    setFile({ name, path, data: bytes });
    setPdf(loaded); setPages(loaded.numPages); setPage(1); setZoom(1); setRotation(0);
    setHistory([{ data: bytes.slice(), name }]); setHistoryIndex(0);
    setNotice(`${name} aberto`);
  }, []);

  async function openPdf() {
    try {
      const selected = await window.crossEdit.openPdf();
      if (selected) await loadBytes(selected.data, selected.name, selected.path);
    } catch (error) { console.error(error); setNotice("Não foi possível abrir este PDF."); }
  }

  async function saveAs() {
    if (!file) return;
    try {
      setBusy(true);
      const result = await window.crossEdit.savePdfAs({ name: file.name, data: file.data });
      if (!result.canceled) setNotice("Documento guardado com sucesso");
    } catch (error) { console.error(error); setNotice("Erro ao guardar documento."); }
    finally { setBusy(false); }
  }

  const commitDocument = useCallback(async (bytes: Uint8Array, message: string) => {
    if (!file) return;
    const next = new Uint8Array(bytes);
    const loaded = await getDocument({ data: next.slice() }).promise;
    setFile({ ...file, data: next }); setPdf(loaded); setPages(loaded.numPages);
    setPage(p => Math.min(p, loaded.numPages));
    setHistory(old => {
      const trimmed = old.slice(0, historyIndex + 1);
      trimmed.push({ data: next.slice(), name: file.name });
      return trimmed.slice(-31);
    });
    setHistoryIndex(i => Math.min(i + 1, 30));
    setNotice(message);
  }, [file, historyIndex]);

  async function undo() {
    if (historyIndex <= 0) return;
    const item = history[historyIndex - 1];
    const loaded = await getDocument({ data: item.data.slice() }).promise;
    setFile(f => f ? { ...f, data: item.data.slice() } : f);
    setPdf(loaded); setPages(loaded.numPages); setPage(p => Math.min(p, loaded.numPages));
    setHistoryIndex(i => i - 1); setNotice("Alteração desfeita");
  }
  async function redo() {
    if (historyIndex >= history.length - 1) return;
    const item = history[historyIndex + 1];
    const loaded = await getDocument({ data: item.data.slice() }).promise;
    setFile(f => f ? { ...f, data: item.data.slice() } : f);
    setPdf(loaded); setPages(loaded.numPages); setPage(p => Math.min(p, loaded.numPages));
    setHistoryIndex(i => i + 1); setNotice("Alteração refeita");
  }

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!pdf || !canvasRef.current) return;
      try {
        const current = await pdf.getPage(page);
        const viewport = current.getViewport({ scale: zoom, rotation });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
        await current.render({ canvasContext: context, viewport }).promise;
        if (cancelled) return;
      } catch (error) { console.error(error); }
    }
    void render();
    return () => { cancelled = true; };
  }, [pdf, page, zoom, rotation]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    async function renderThumbs() {
      for (let i = 1; i <= pdf!.numPages; i++) {
        const canvas = thumbRefs.current.get(i);
        if (!canvas) continue;
        try {
          const p = await pdf!.getPage(i);
          const vp = p.getViewport({ scale: 0.22 });
          canvas.width = vp.width; canvas.height = vp.height;
          const ctx = canvas.getContext("2d");
          if (ctx) await p.render({ canvasContext: ctx, viewport: vp }).promise;
        } catch (e) { if (!cancelled) console.error(e); }
      }
    }
    void renderThumbs();
    return () => { cancelled = true; };
  }, [pdf, pages]);

  async function rotatePage() {
    if (!file) return;
    try {
      const doc = await PDFDocument.load(file.data);
      const target = doc.getPage(page - 1);
      target.setRotation(degrees((target.getRotation().angle + 90) % 360));
      await commitDocument(await doc.save(), "Página rodada");
    } catch (e) { console.error(e); setNotice("Não foi possível rodar a página."); }
  }

  async function pageClick(e: MouseEvent<HTMLDivElement>) {
    if (!file || tool === "select") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    try {
      const doc = await PDFDocument.load(file.data);
      const target = doc.getPage(page - 1);
      const { width, height } = target.getSize();
      const x = xRatio * width;
      const y = (1 - yRatio) * height;
      if (tool === "text" || tool === "signature") {
        const value = window.prompt(tool === "signature" ? "Escreve o texto da assinatura:" : "Texto a inserir:");
        if (!value) return;
        const font = await doc.embedFont(StandardFonts.Helvetica);
        target.drawText(value, { x, y, size: tool === "signature" ? 22 : 14, font, color: rgb(0.08, 0.1, 0.16) });
        await commitDocument(await doc.save(), tool === "signature" ? "Assinatura adicionada" : "Texto adicionado");
      } else if (tool === "highlight") {
        target.drawRectangle({ x, y: y - 9, width: Math.min(150, width - x), height: 18, color: rgb(1, 0.88, 0.2), opacity: 0.38, borderWidth: 0 });
        await commitDocument(await doc.save(), "Realce adicionado");
      } else if (tool === "shape") {
        target.drawRectangle({ x, y, width: Math.min(100, width - x), height: Math.min(55, height - y), borderColor: rgb(0.35, 0.28, 0.85), borderWidth: 1.5, color: rgb(1, 1, 1), opacity: 0 });
        await commitDocument(await doc.save(), "Forma adicionada");
      } else if (tool === "draw") {
        target.drawLine({ start: { x: Math.max(0, x - 35), y: y - 20 }, end: { x, y }, thickness: 2, color: rgb(0.25, 0.22, 0.7) });
        await commitDocument(await doc.save(), "Traço adicionado");
      }
    } catch (error) { console.error(error); setNotice("Não foi possível aplicar a ferramenta."); }
  }

  async function addImage() {
    if (!file || !selectedImage) return;
    try {
      const doc = await PDFDocument.load(file.data);
      const target = doc.getPage(page - 1);
      const image = imageType === "png" ? await doc.embedPng(selectedImage) : await doc.embedJpg(selectedImage);
      const size = image.scale(Math.min(180 / image.width, 130 / image.height, 1));
      const { width, height } = target.getSize();
      target.drawImage(image, { x: (width - size.width) / 2, y: (height - size.height) / 2, width: size.width, height: size.height });
      await commitDocument(await doc.save(), "Imagem inserida no centro da página");
      setSelectedImage(null); setTool("select");
    } catch (error) { console.error(error); setNotice("Formato de imagem inválido. Usa PNG ou JPG."); }
  }

  async function chooseImage(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    const type = f.type === "image/png" ? "png" : "jpg";
    if (!["image/png", "image/jpeg"].includes(f.type)) { setNotice("Escolhe uma imagem PNG ou JPG."); return; }
    setSelectedImage(bytes); setImageType(type); setNotice("Imagem selecionada. Clica em Inserir imagem para a adicionar.");
  }

  async function deletePage() {
    if (!file || pages <= 1) return;
    const doc = await PDFDocument.load(file.data); doc.removePage(page - 1);
    await commitDocument(await doc.save(), "Página eliminada");
  }
  async function duplicatePage() {
    if (!file) return;
    const doc = await PDFDocument.load(file.data);
    const [copy] = await doc.copyPages(doc, [page - 1]);
    doc.insertPage(page, copy);
    await commitDocument(await doc.save(), "Página duplicada");
    setPage(page + 1);
  }
  async function movePage(direction: -1 | 1) {
    if (!file) return;
    const destination = page - 1 + direction;
    if (destination < 0 || destination >= pages) return;
    const doc = await PDFDocument.load(file.data);
    const [copy] = await doc.copyPages(doc, [page - 1]);
    doc.removePage(page - 1); doc.insertPage(destination, copy);
    await commitDocument(await doc.save(), "Ordem das páginas atualizada");
    setPage(destination + 1);
  }
  async function mergePdfs() {
    if (!file) return;
    const selected = await window.crossEdit.openMultiplePdfs();
    if (!selected?.length) return;
    try {
      const merged = await PDFDocument.load(file.data);
      for (const item of selected) {
        const source = await PDFDocument.load(item.data);
        const copied = await merged.copyPages(source, source.getPageIndices());
        copied.forEach(p => merged.addPage(p));
      }
      await commitDocument(await merged.save(), "PDFs unidos com sucesso");
    } catch (e) { console.error(e); setNotice("Não foi possível juntar os PDFs selecionados."); }
  }


  useEffect(() => {
    void window.crossEdit.getVersion().then(setAppVersion).catch(() => undefined);
    const unsubscribe = window.crossEdit.onUpdateStatus(({ status, detail }) => {
      setUpdateStatus(status); setUpdateDetail(detail ?? "");
      if (status === "available") setNotice(`Atualização ${detail ?? "disponível"} encontrada`);
      else if (status === "downloaded") setNotice(`Atualização ${detail ?? ""} pronta para instalar`);
      else if (status === "current") setNotice("O CrossEdit está atualizado");
      else if (status === "unconfigured") setNotice("Atualizações automáticas serão ativadas após configurar o repositório de versões");
    });
    return unsubscribe;
  }, []);

  async function checkUpdates() {
    setUpdateStatus("checking");
    const result = await window.crossEdit.checkForUpdates();
    if (result.status === "unconfigured") { setUpdateStatus("unconfigured"); setNotice("Atualizações: falta configurar o repositório GitHub"); }
    else if (result.status === "error") { setUpdateStatus("error"); setNotice(`Falha ao verificar atualizações: ${result.detail ?? "erro desconhecido"}`); }
  }

  const tools = [
    { id: "select" as Tool, label: "Selecionar", icon: MousePointer2 },
    { id: "text" as Tool, label: "Texto", icon: Type },
    { id: "highlight" as Tool, label: "Realçar", icon: Highlighter },
    { id: "draw" as Tool, label: "Desenhar", icon: PenLine },
    { id: "shape" as Tool, label: "Forma", icon: Square },
    { id: "signature" as Tool, label: "Assinar", icon: Signature }
  ];

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><img className="brand-logo" src="/assets/crossedit-logo.svg" alt="CrossEdit"/><span>cross<span className="brand-light">edit</span></span><span className="version">DESKTOP</span></div>
      <div className="top-actions">
        <button className="icon-button" title="Novo documento" onClick={() => { setFile(null); setPdf(null); setPages(0); setHistory([]); setHistoryIndex(-1); }}><FilePlus2 /></button>
        <button className="icon-button" title="Abrir PDF" onClick={openPdf}><FolderOpen /></button>
        <button className="icon-button" title="Guardar como" onClick={saveAs} disabled={!file || busy}><Save /></button>
        <span className="top-divider" />
        <button className="icon-button" title="Desfazer" onClick={undo} disabled={historyIndex <= 0}><Undo2 /></button>
        <button className="icon-button" title="Refazer" onClick={redo} disabled={historyIndex >= history.length - 1}><Redo2 /></button>
      </div>
      <div className="top-right"><span className="offline"><span /> Offline</span>
        <button className="update-button" onClick={updateStatus === "available" ? () => void window.crossEdit.downloadUpdate() : updateStatus === "downloaded" ? () => void window.crossEdit.installUpdate() : checkUpdates} title="Verificar atualizações">
          {updateStatus === "downloaded" ? <DownloadCloud size={15}/> : <RefreshCw size={14}/>}
          <span>{updateStatus === "available" ? "Descarregar" : updateStatus === "downloaded" ? "Reiniciar e atualizar" : updateStatus === "checking" ? "A verificar…" : "Atualizações"}</span>
        </button><button className="avatar">CE</button></div>
    </header>
    <nav className="menu-bar">
      <button onClick={openPdf}>Ficheiro</button><button onClick={() => setTool("select")}>Editar</button><button onClick={() => setNotice("Ferramentas de visualização")}>Visualizar</button><button onClick={rotatePage}>Página</button><button onClick={() => setNotice("CrossEdit 0.3.0 — ajuda")}>Ajuda</button>
      <div className="menu-spacer" /><span className="document-name">{file?.name ?? "Sem documento aberto"}</span>
    </nav>
    <div className="workspace">
      <aside className={`left-sidebar ${sidebar ? "" : "hidden"}`}>
        <div className="side-tabs"><button className="active"><PanelsTopLeft size={16}/> Páginas</button><button onClick={() => setNotice("Pesquisa de texto: próxima atualização")}><ScanText size={16}/> Localizar</button></div>
        {file ? <div className="thumbnail-list">
          {Array.from({ length: pages }, (_, i) => <div key={i} className={`thumbnail ${page === i + 1 ? "selected" : ""}`}>
            <button className="thumb-select" onClick={() => setPage(i + 1)}><canvas ref={el => { if (el) thumbRefs.current.set(i + 1, el); else thumbRefs.current.delete(i + 1); }} /><small>Página {i + 1}</small></button>
          </div>)}
        </div> : <div className="sidebar-empty"><Files size={25}/><p>Abre um PDF para ver as páginas.</p></div>}
        <div className="sidebar-footer"><span>{pages} páginas</span><span>Local</span></div>
      </aside>
      <main className="editor-area">
        <div className="tool-ribbon">
          <div className="tool-group">{tools.map(({ id, label, icon: Icon }) => <button key={id} title={label} className={`tool-button ${tool === id ? "chosen" : ""}`} onClick={() => setTool(id)} disabled={!file}><Icon size={18}/><span>{label}</span></button>)}</div>
          <div className="ribbon-divider"/>
          <button className="tool-button" onClick={() => imageInputRef.current?.click()} disabled={!file}><ImageIcon size={18}/><span>Inserir imagem</span></button>
          <button className="tool-button" onClick={addImage} disabled={!file || !selectedImage}><Download size={18}/><span>Aplicar imagem</span></button>
          <button className="tool-button" onClick={rotatePage} disabled={!file}><RotateCw size={18}/><span>Rodar página</span></button>
        </div>
        <div className="canvas-toolbar">
          <button className="icon-button small" onClick={() => setSidebar(!sidebar)} title="Mostrar/ocultar páginas"><Menu size={17}/></button>
          <div className="page-control"><button className="icon-button small" disabled={!file || page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft size={17}/></button><input aria-label="Número da página" value={file ? page : 0} onChange={e => { const n = Number(e.target.value); if (n >= 1 && n <= pages) setPage(n); }}/><span>/ {pages}</span><button className="icon-button small" disabled={!file || page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}><ChevronRight size={17}/></button></div>
          <div className="toolbar-spacer"/>
          <button className="icon-button small" onClick={() => setZoom(z => Math.max(.35, z - .1))}><ZoomOut size={17}/></button><span className="zoom-label">{Math.round(zoom * 100)}%</span><button className="icon-button small" onClick={() => setZoom(z => Math.min(2.5, z + .1))}><ZoomIn size={17}/></button>
          <button className="icon-button small" title="Guardar" onClick={saveAs} disabled={!file}><Download size={17}/></button><button className="icon-button small" title="Imprimir" onClick={() => window.print()} disabled={!file}><FileText size={17}/></button>
        </div>
        <div className="document-stage" onClick={pageClick}>
          {pdf ? <div className="page-wrap"><canvas ref={canvasRef}/></div> : <div className="welcome"><div className="welcome-icon"><FileText size={34}/></div><h1>O teu espaço de documentos.</h1><p>Abre um PDF para editar, organizar e transformar os teus documentos.</p><button className="primary-button" onClick={openPdf}><FolderOpen size={18}/> Abrir documento PDF</button></div>}
          {busy && <div className="busy-overlay">A processar documento…</div>}
        </div>
        <footer className="statusbar"><span className="status-dot"/>{notice}<span className="status-spacer"/><span>CrossEdit {appVersion}</span><span>•</span><span>Processamento local</span></footer>
      </main>
      <aside className="right-sidebar">
        <div className="properties-heading"><span>PROPRIEDADES / PÁGINA</span><button className="icon-button small"><X size={15}/></button></div>
        <div className="properties-content">
          <div className="property-card"><div className="property-icon"><FileText size={20}/></div><h3>Documento</h3><p>{file?.name ?? "Nenhum documento selecionado"}</p></div>
          <div className="property-section"><h4>INFORMAÇÕES</h4><div className="property-row"><span>Páginas</span><b>{pages || "—"}</b></div><div className="property-row"><span>Página atual</span><b>{file ? `${page} de ${pages}` : "—"}</b></div><div className="property-row"><span>Zoom</span><b>{Math.round(zoom * 100)}%</b></div></div>
          <div className="quick-tools"><h4>PÁGINAS</h4>
            <button onClick={duplicatePage} disabled={!file}><Copy size={17}/> Duplicar página</button>
            <button onClick={deletePage} disabled={!file || pages <= 1}><Trash2 size={17}/> Eliminar página</button>
            <button onClick={() => movePage(-1)} disabled={!file || page <= 1}><ArrowUp size={17}/> Mover para cima</button>
            <button onClick={() => movePage(1)} disabled={!file || page >= pages}><ArrowDown size={17}/> Mover para baixo</button>
            <button onClick={mergePdfs} disabled={!file}><Merge size={17}/> Juntar outros PDFs</button>
          </div>
          <div className="quick-tools"><h4>FERRAMENTAS</h4>
            <button onClick={() => setNotice("Divisão: seleciona páginas e usa Guardar como numa próxima atualização")}><Scissors size={17}/> Dividir PDF</button>
            <button onClick={() => setNotice("Compressão avançada será adicionada na próxima versão")}><Minimize2 size={17}/> Comprimir PDF</button>
            <button onClick={() => setNotice("OCR requer o pacote de idiomas offline; será integrado na versão 0.3")}><ScanText size={17}/> Reconhecer texto (OCR)</button>
            <button onClick={() => setNotice("Proteção por palavra-passe será integrada numa próxima versão")}><ShieldCheck size={17}/> Proteger PDF</button>
          </div>
        </div>
      </aside>
    </div>
    <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={chooseImage}/>
  </div>;
}