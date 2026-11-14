import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent, ReactNode } from 'react';
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, BrainCircuit,
  CalendarClock, CalendarDays, Check, CheckCheck, ChevronRight,
  CircleCheck, Clock3, FileCheck2, FileSearch, FileText,
  FolderOpen, HardDrive, Info, LayoutDashboard, ListChecks,
  LoaderCircle, LockKeyhole, Menu, Plus, ScanText,
  Search, ShieldCheck, Sparkles, Trash2, UploadCloud, WandSparkles,
  X, Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type View = 'overview' | 'documents' | 'tasks' | 'insights';
type Insight = { kind: 'date' | 'amount' | 'note'; title: string; detail: string; evidence: string };
type DocumentItem = {
  id: string; filename: string; filetype: string; filesize: number;
  summary: string; mode: string; created_at: string;
  extracted_chars: number; preview: string; insights: Insight[];
};
type DocumentDetail = DocumentItem & { extracted_text: string };
type TaskItem = {
  id: string; document_id: string | null; title: string;
  description: string; due_date: string | null; evidence: string;
  status: 'open' | 'done'; origin: string; created_at: string;
};
type Stats = {
  documents: number; open_tasks: number; done_tasks: number;
  upcoming: number; overdue: number; ai_available: boolean; ocr_available: boolean;
};
type TaskFilter = 'all' | 'open' | 'done';

const EMPTY_STATS: Stats = {
  documents: 0, open_tasks: 0, done_tasks: 0,
  upcoming: 0, overdue: 0, ai_available: false, ocr_available: false,
};
const NAV: { value: View; label: string; icon: LucideIcon }[] = [
  { value: 'overview', label: 'Overzicht', icon: LayoutDashboard },
  { value: 'documents', label: 'Documenten', icon: FolderOpen },
  { value: 'tasks', label: 'Mijn acties', icon: ListChecks },
  { value: 'insights', label: 'Inzichten', icon: Sparkles },
];
const DEMO_TEXT = `Gemeente Exampledam — Voorbeeldbrief (fictief)\n\nBeste inwoner,\n\nU dient uw aanvraagformulier uiterlijk 15 december 2026 in te dienen bij de balie. Vergeet niet om uw identiteitskaart mee te nemen.\n\nDe administratieve bijdrage van € 48,50 moet voor 10 december 2026 betaald worden. Vermeld bij uw betaling referentie EX-2026-100.\n\nHeeft u vragen? Neem contact op met de gemeentelijke informatiedienst.\n\nMet vriendelijke groeten,\nDienst Informatie — Exampledam\n\nDit is een fictief document, uitsluitend bedoeld om ACTOVYNA te demonstreren.`;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error('De server is niet bereikbaar. Start eerst de Python-backend.');
  }
  if (!response.ok) {
    let message = `Er ging iets mis (${response.status}).`;
    try {
      const payload = await response.json() as { detail?: string | unknown[] };
      if (typeof payload.detail === 'string') message = payload.detail;
    } catch { /* Keep generic fallback message. */ }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function dateLabel(date: string | null): string {
  if (!date) return 'Geen datum';
  const value = new Date(`${date.substring(0, 10)}T12:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' }).format(value);
}
function sizeLabel(value: number): string {
  return value < 1024 ? `${value} B` : value < 1048576
    ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1048576).toFixed(1)} MB`;
}
function daysLeft(date: string | null): number | null {
  if (!date) return null;
  const day = new Date(`${date}T12:00:00`).getTime();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((day - today.getTime()) / 86400000);
}
function dueBadge(date: string | null): { label: string; tone: string } {
  const days = daysLeft(date);
  if (days === null) return { label: 'Geen deadline', tone: 'neutral' };
  if (days < 0) return { label: `${Math.abs(days)} d. te laat`, tone: 'danger' };
  if (days === 0) return { label: 'Vandaag', tone: 'danger' };
  if (days <= 7) return { label: `Over ${days} dagen`, tone: 'warning' };
  return { label: dateLabel(date), tone: 'neutral' };
}
function BrandMark({ size = 38 }: { size?: number }) {
  return <div className="brand-mark" style={{ width: size, height: size }}>
    <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 36 22 11h5l12 25h-7L24.5 20 17 36z" fill="url(#logoGradient)"/><path d="M18.5 29.5h14" stroke="white" strokeWidth="3.2" strokeLinecap="round"/><defs><linearGradient id="logoGradient" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#aca2ff"/><stop offset="1" stopColor="#59f0cc"/></linearGradient></defs></svg>
  </div>;
}
function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow"><span className="tiny-spark">✦</span>{children}</div>;
}
function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><Eyebrow>{eyebrow}</Eyebrow><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}
function StatCard({ label, value, helper, icon: Icon, hue }: { label: string; value: number | string; helper: string; icon: LucideIcon; hue: 'purple' | 'teal' | 'gold' | 'blue' }) {
  return <div className={`stat-card hue-${hue}`}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={19} strokeWidth={1.8}/></span></div><div className="stat-value">{value}</div><div className="stat-helper"><span className="little-dot"/>{helper}</div></div>;
}
function DocIcon({ type }: { type: string }) {
  return <div className={`doc-icon doc-${type}`}><FileText size={22} strokeWidth={1.6}/></div>;
}
function LoadingIcon() { return <LoaderCircle className="spin" size={17}/>; }

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | null>(null);
  const [taskModal, setTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [search, setSearch] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const notify = useCallback((message: string, error = false) => {
    setToast({ message, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4600);
  }, []);

  const reload = useCallback(async () => {
    try {
      const [loadedDocs, loadedTasks, loadedStats] = await Promise.all([
        request<DocumentItem[]>('/api/documents'),
        request<TaskItem[]>('/api/tasks'),
        request<Stats>('/api/stats'),
      ]);
      setDocuments(loadedDocs);
      setTasks(loadedTasks);
      setStats(loadedStats);
      setOnline(true);
    } catch (error) {
      setOnline(false);
      notify(error instanceof Error ? error.message : 'Kan gegevens niet laden.', true);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSelectedDoc(null); setTaskModal(false); setMobileNav(false); }
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  const filteredDocuments = useMemo(() => documents.filter(d =>
    `${d.filename} ${d.summary} ${d.preview}`.toLowerCase().includes(search.toLowerCase())), [documents, search]);
  const filteredTasks = useMemo(() => tasks
    .filter(t => taskFilter === 'all' || t.status === taskFilter)
    .filter(t => `${t.title} ${t.description} ${t.evidence}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
      return (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31');
    }), [tasks, taskFilter, search]);
  const insights = useMemo(() => documents.flatMap(doc =>
    doc.insights.map(item => ({ ...item, document: doc }))).filter(i =>
    `${i.title} ${i.detail} ${i.document.filename}`.toLowerCase().includes(search.toLowerCase())), [documents, search]);
  const upcomingTasks = useMemo(() => tasks.filter(t => t.status === 'open')
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')).slice(0, 4), [tasks]);
  const totalTasks = stats.done_tasks + stats.open_tasks;
  const progress = totalTasks ? Math.round(100 * stats.done_tasks / totalTasks) : 0;

  function navigate(next: View) { setView(next); setMobileNav(false); }

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { notify('Bestand te groot: maximaal 8 MB.', true); return; }
    setUploading(true);
    const body = new FormData();
    body.append('file', file);
    try {
      const document = await request<DocumentItem>(`/api/documents?use_ai=${useAi}`, { method: 'POST', body });
      notify(`“${document.filename}” is geanalyseerd.`);
      await reload();
      setView('documents');
      const full = await request<DocumentDetail>(`/api/documents/${document.id}`);
      setSelectedDoc(full);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Upload mislukt.', true);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  function uploadInput(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (file) void handleFile(file); }
  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragActive(false); const file = event.dataTransfer.files?.[0]; if (file) void handleFile(file); }
  async function openDocument(id: string) {
    try { setSelectedDoc(await request<DocumentDetail>(`/api/documents/${id}`)); }
    catch (error) { notify(error instanceof Error ? error.message : 'Document kan niet geopend worden.', true); }
  }
  async function removeDocument(id: string) {
    if (!window.confirm('Dit document en de bijbehorende acties definitief verwijderen?')) return;
    try { await request<void>(`/api/documents/${id}`, { method: 'DELETE' }); setSelectedDoc(null); notify('Document verwijderd.'); await reload(); }
    catch (error) { notify(error instanceof Error ? error.message : 'Verwijderen mislukt.', true); }
  }
  async function toggleTask(task: TaskItem) {
    try {
      await request<TaskItem>(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: task.status === 'done' ? 'open' : 'done' }) });
      await reload();
    } catch (error) { notify(error instanceof Error ? error.message : 'Taak bijwerken mislukt.', true); }
  }
  async function removeTask(id: string) {
    if (!window.confirm('Deze actie verwijderen?')) return;
    try { await request<void>(`/api/tasks/${id}`, { method: 'DELETE' }); await reload(); notify('Actie verwijderd.'); }
    catch (error) { notify(error instanceof Error ? error.message : 'Verwijderen mislukt.', true); }
  }
  async function addTask(event: FormEvent) {
    event.preventDefault();
    try {
      await request<TaskItem>('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: taskTitle, description: taskDescription, due_date: taskDueDate || null }) });
      setTaskModal(false); setTaskTitle(''); setTaskDescription(''); setTaskDueDate('');
      notify('Nieuwe actie toegevoegd.'); await reload(); setView('tasks');
    } catch (error) { notify(error instanceof Error ? error.message : 'Toevoegen mislukt.', true); }
  }
  async function exportData() {
    try {
      const response = await fetch('/api/export');
      if (!response.ok) throw new Error('Export is mislukt.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'actovyna-export.json';
      anchor.click(); URL.revokeObjectURL(url);
      notify('Je gegevens zijn geëxporteerd.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Export is mislukt.', true); }
  }
  function tryDemo() { void handleFile(new File([DEMO_TEXT], 'voorbeeldbrief.txt', { type: 'text/plain' })); }
  const openUpload = () => fileInput.current?.click();

  function uploadZone(compact = false) {
    return <div className={`upload-zone ${compact ? 'compact' : ''} ${dragActive ? 'drag-over' : ''}`}
      onDragOver={event => { event.preventDefault(); setDragActive(true); }}
      onDragLeave={event => { event.preventDefault(); setDragActive(false); }}
      onDrop={onDrop}>
      <div className="upload-icon"><UploadCloud size={26} strokeWidth={1.6}/></div>
      <h3>{uploading ? 'Document wordt verwerkt…' : 'Sleep je document hierheen'}</h3>
      <p>of selecteer een bestand vanaf je computer</p>
      <button className="btn btn-outline" onClick={openUpload} type="button" disabled={uploading}>
        {uploading ? <LoadingIcon/> : <Plus size={16}/>} {uploading ? 'Analyseren…' : 'Bestand selecteren'}
      </button>
      <div className="upload-spec">PDF · DOCX · TXT · MD · PNG · JPG · WEBP <span>·</span> MAX 8 MB</div>
    </div>;
  }

  function docCards(list: DocumentItem[]) {
    if (!list.length) return <div className="empty-state"><FileSearch size={36}/><h3>Geen documenten gevonden</h3><p>Upload je eerste bestand of pas je zoekopdracht aan.</p><button className="btn btn-primary" onClick={openUpload}><Plus size={15}/> Document toevoegen</button></div>;
    return <div className="document-list">{list.map(doc =>
      <button type="button" key={doc.id} className="document-row" onClick={() => void openDocument(doc.id)}>
        <DocIcon type={doc.filetype}/><div className="document-info"><strong>{doc.filename}</strong><span>{doc.summary || 'Geen samenvatting'} </span></div>
        <div className="document-meta"><span>{dateLabel(doc.created_at)}</span><span>{sizeLabel(doc.filesize)}</span></div>
        <span className={`mode-pill ${doc.mode === 'ai' ? 'ai' : ''}`}>{doc.mode === 'ai' ? 'AI' : 'Lokaal'}</span>
        <ChevronRight size={18} className="row-chevron"/>
      </button>)}</div>;
  }
  function taskRows(list: TaskItem[], full = false) {
    if (!list.length) return <div className="empty-state short"><CheckCheck size={32}/><h3>Alles bijgewerkt</h3><p>Er staan hier momenteel geen acties.</p><button className="btn btn-outline" onClick={() => setTaskModal(true)}><Plus size={14}/> Voeg een actie toe</button></div>;
    return <div className="task-list">{list.map(task => {
      const due = dueBadge(task.due_date);
      return <div key={task.id} className={`task-row ${task.status === 'done' ? 'finished' : ''}`}>
        <button type="button" className={`check-button ${task.status === 'done' ? 'checked' : ''}`} aria-label={task.status === 'done' ? 'Markeer als open' : 'Markeer als voltooid'} onClick={() => void toggleTask(task)}>{task.status === 'done' && <Check size={14}/>}</button>
        <div className="task-info"><strong>{task.title}</strong><span>{task.description || (task.origin === 'manual' ? 'Handmatig toegevoegd' : 'Gevonden in een document')}</span>{full && task.evidence && <blockquote>“{task.evidence}”</blockquote>}</div>
        {task.status === 'open' && <span className={`due-pill ${due.tone}`}><Clock3 size={12}/>{due.label}</span>}
        {full && <button className="icon-button subtle" aria-label="Verwijder actie" title="Verwijder actie" onClick={() => void removeTask(task.id)}><Trash2 size={15}/></button>}
      </div>;
    })}</div>;
  }

  return <div className="app-frame">
    <input className="sr-only" type="file" ref={fileInput} accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" onChange={uploadInput} />
    <div className="app-glow" aria-hidden="true"/>

    <aside className={`sidebar ${mobileNav ? 'show' : ''}`}>
      <div className="brand-wrap"><BrandMark/><div><div className="brand-word">ACTOVYNA<span className="brand-period">.</span></div><div className="brand-caption">CLARITY, IN MOTION</div></div></div>
      <div className="sidebar-spacer"/>
      <div className="sidebar-section-label">WERKRUIMTE <span>01</span></div>
      <nav className="side-nav" aria-label="Hoofdnavigatie">{NAV.map(item => {
        const Icon = item.icon;
        return <button key={item.value} type="button" className={`nav-link ${view === item.value ? 'active' : ''}`} onClick={() => navigate(item.value)}>
          <Icon size={19} strokeWidth={1.75}/><span>{item.label}</span>{item.value === 'tasks' && stats.open_tasks > 0 && <b className="nav-count">{stats.open_tasks}</b>}
        </button>;
      })}</nav>
      <div className="sidebar-separator"/>
      <div className="sidebar-section-label">SNELLE ACTIES</div>
      <button className="nav-link quiet" onClick={openUpload}><Plus size={18}/> Nieuw document</button>
      <button className="nav-link quiet" onClick={() => setTaskModal(true)}><CalendarDays size={18}/> Nieuwe actie</button>
      <div className="sidebar-bottom">
        <div className="sidebar-help"><div className="help-spark"><WandSparkles size={17}/></div><strong>Meer rust in je hoofd.</strong><p>Van ingewikkeld document naar een helder actieplan.</p><button onClick={tryDemo} disabled={uploading}>Bekijk de demo <ArrowUpRight size={14}/></button></div>
        <div className="profile-line"><div className="profile-avatar">A</div><div><strong>Mijn werkruimte</strong><span>Lokale omgeving</span></div><span className="online-dot" title="Lokaal opgeslagen"/></div>
      </div>
    </aside>

    {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Sluit navigatie"/>}
    <div className="work-area">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigatie"><Menu size={21}/></button>
        <div className="breadcrumb">WERKRUIMTE <ChevronRight size={13}/> <span>{NAV.find(i => i.value === view)?.label}</span></div>
        <div className="top-actions"><label className="search-box"><Search size={16}/><input ref={searchInput} aria-label="Zoeken" value={search} onChange={event => setSearch(event.target.value)} placeholder="Zoek documenten of acties…"/><kbd>/</kbd></label>
          <span className={`connection-pill ${online ? '' : 'offline'}`}><span className="connection-dot"/>{online ? 'Systeem actief' : 'Server offline'}</span>
          <button className="icon-button export-button" onClick={() => void exportData()} aria-label="Exporteer gegevens" title="Exporteer gegevens"><ArrowDownToLine size={18}/></button>
        </div>
      </header>

      <main className="main-content">
        {!online && !loading && <div className="error-banner"><Info size={18}/><div><strong>De backend is niet bereikbaar.</strong><span>Start Python of gebruik Docker Compose en vernieuw de pagina.</span></div><button onClick={() => void reload()}>Opnieuw proberen</button></div>}

        {view === 'overview' && <>
          <div className="welcome-line"><div className="welcome-date"><span className="signal-burst"/> JOUW PERSOONLIJKE COMMAND CENTER</div><span className="current-date">{new Intl.DateTimeFormat('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span></div>
          <section className="hero-card"><div className="hero-copy"><Eyebrow>INTELLIGENT WORKSPACE · V1.0</Eyebrow><h1>Van chaos naar <em>helderheid.</em></h1><p>Je documenten, deadlines en belangrijke acties. Allemaal op één plek. Zonder ruis, zonder gedoe.</p><div className="hero-buttons"><button className="btn btn-white" onClick={openUpload}><UploadCloud size={18}/> Analyseer een document <ArrowUpRight size={16}/></button><button className="btn btn-transparent" onClick={tryDemo} disabled={uploading}>Probeer de demo <ArrowRight size={16}/></button></div><div className="hero-note"><ShieldCheck size={14}/> Lokale analyse beschikbaar · AI alleen met toestemming</div></div>
            <div className="hero-art" aria-hidden="true"><div className="orbital orbital-one"/><div className="orbital orbital-two"/><div className="orbital orbital-three"/><div className="art-sun"><div className="art-inner">A</div></div><div className="orbit-speck speck-one"/><div className="orbit-speck speck-two"/><div className="orbit-speck speck-three"/><div className="art-floating-tag tag-top"><Sparkles size={12}/> MAKE SENSE OF EVERYTHING</div><div className="art-floating-tag tag-bottom">01 / ∞ &nbsp; POSSIBILITIES</div></div>
          </section>
          <div className="section-header stats-title"><div><div className="section-label">JOUW ACTIVITEIT</div><h2>Alles in één oogopslag <span className="light-subtitle">/ live bijgewerkt</span></h2></div><button className="text-action" onClick={() => navigate('insights')}>Bekijk inzichten <ArrowUpRight size={15}/></button></div>
          <div className="stats-grid"><StatCard label="Documenten" value={stats.documents} helper="Geanalyseerde bestanden" icon={FileCheck2} hue="purple"/><StatCard label="Openstaande acties" value={stats.open_tasks} helper={stats.overdue ? `${stats.overdue} achterstallig` : 'Nog op te volgen'} icon={ListChecks} hue="teal"/><StatCard label="Komende deadlines" value={stats.upcoming} helper="Binnen 7 dagen" icon={CalendarClock} hue="gold"/><StatCard label="Afgeronde acties" value={stats.done_tasks} helper={`${progress}% van je acties voltooid`} icon={CircleCheck} hue="blue"/></div>
          <div className="overview-bottom"><section className="panel recent-panel"><div className="panel-heading"><div><span className="section-label">YOUR LIBRARY</span><h2>Recente documenten</h2></div><button className="text-action" onClick={() => navigate('documents')}>Alles bekijken <ArrowUpRight size={15}/></button></div>{docCards(filteredDocuments.slice(0, 4))}</section><section className="panel actions-panel"><div className="panel-heading"><div><span className="section-label">STAY ON TRACK</span><h2>Volgende acties</h2></div><button className="icon-button" title="Nieuwe actie" aria-label="Nieuwe actie" onClick={() => setTaskModal(true)}><Plus size={18}/></button></div>{taskRows(upcomingTasks)}<div className="completion-box"><div><span>JOUW VOORTGANG</span><strong>{progress}%</strong></div><div className="progress-track"><div style={{ width: `${progress}%` }}/></div><small>{stats.done_tasks} van {totalTasks} acties afgerond</small></div></section></div>
        </>}

        {view === 'documents' && <><PageHeading eyebrow="YOUR DOCUMENT INTELLIGENCE" title="Mijn documenten" subtitle="Upload, analyseer en vind alles terug op één centrale plek." action={<button className="btn btn-primary" onClick={openUpload}><Plus size={17}/> Nieuw document</button>}/>
          <section className="panel document-panel"><div className="panel-heading"><div><span className="section-label">DOCUMENT WORKSPACE</span><h2>Nieuwe analyse starten</h2></div><span className="privacy-stamp"><LockKeyhole size={14}/> Privacyvriendelijke standaard</span></div>{uploadZone()}
            <label className={`ai-switch ${!stats.ai_available ? 'unavailable' : ''}`}><input type="checkbox" checked={useAi} disabled={!stats.ai_available} onChange={event => setUseAi(event.target.checked)}/><span className="switch-track"/><div><strong>AI-ondersteunde analyse <span className="optional">OPT-IN</span></strong><small>{stats.ai_available ? 'Als je dit inschakelt, wordt de uitgelezen tekst naar OpenAI verzonden.' : 'Niet beschikbaar. Voeg een eigen OPENAI_API_KEY toe op de server.'}</small></div><BrainCircuit size={21}/></label>
          </section><section className="panel document-panel"><div className="panel-heading"><div><span className="section-label">DIGITAL ARCHIVE</span><h2>Jouw bibliotheek <span className="number-chip">{filteredDocuments.length}</span></h2></div><span className="muted-inline"><HardDrive size={14}/> Opgeslagen in je lokale database</span></div>{docCards(filteredDocuments)}</section></>}

        {view === 'tasks' && <><PageHeading eyebrow="TURN CLARITY INTO ACTION" title="Mijn acties" subtitle="Van belangrijke deadlines tot dagelijkse taken. Jij houdt de controle." action={<button className="btn btn-primary" onClick={() => setTaskModal(true)}><Plus size={17}/> Nieuwe actie</button>}/>
          <div className="stats-grid three"><StatCard label="Nog te doen" value={stats.open_tasks} helper="Openstaande acties" icon={ListChecks} hue="purple"/><StatCard label="Voltooid" value={stats.done_tasks} helper="Goed bezig" icon={CheckCheck} hue="teal"/><StatCard label="Deadline voorbij" value={stats.overdue} helper="Controleer zo snel mogelijk" icon={Clock3} hue="gold"/></div>
          <section className="panel task-panel"><div className="panel-heading"><div><span className="section-label">ACTION CENTER</span><h2>Actieoverzicht</h2></div><div className="tabs" role="group" aria-label="Filter acties"><button className={taskFilter === 'all' ? 'selected' : ''} onClick={() => setTaskFilter('all')}>Alle</button><button className={taskFilter === 'open' ? 'selected' : ''} onClick={() => setTaskFilter('open')}>Open</button><button className={taskFilter === 'done' ? 'selected' : ''} onClick={() => setTaskFilter('done')}>Voltooid</button></div></div>{taskRows(filteredTasks, true)}</section></>}

        {view === 'insights' && <><PageHeading eyebrow="SIGNALS FROM YOUR DOCUMENTS" title="Slimme inzichten" subtitle="Belangrijke bedragen, datums en informatie — rechtstreeks uit je eigen documenten." action={<button className="btn btn-outline" onClick={() => void exportData()}><ArrowDownToLine size={17}/> Exporteer alles</button>}/>
          <div className="insight-intro"><div className="insight-orb"><ScanText size={25}/></div><div><strong>Informatie met bronvermelding</strong><p>Elk inzicht laat zien uit welke passage het komt. Controleer belangrijke gegevens altijd zelf.</p></div><span className="counter-label">{insights.length} VONDSTEN</span></div>
          {insights.length ? <div className="insights-grid">{insights.map((insight, index) => <article className="insight-card" key={`${insight.document.id}-${index}`}><div className="insight-card-head"><span className={`insight-symbol ${insight.kind}`}>{insight.kind === 'date' ? <CalendarClock size={20}/> : insight.kind === 'amount' ? <Zap size={20}/> : <BrainCircuit size={20}/>}</span><span className="section-label">{insight.kind === 'date' ? 'DATUM GEVONDEN' : insight.kind === 'amount' ? 'BEDRAG HERKEND' : 'AI-INZICHT'}</span></div><h3>{insight.title}</h3><div className="insight-value">{insight.detail}</div><blockquote>“{insight.evidence}”</blockquote><button className="source-link" onClick={() => void openDocument(insight.document.id)}><FileText size={15}/>{insight.document.filename}<ArrowUpRight size={14}/></button></article>)}</div> : <div className="empty-state large"><BrainCircuit size={36}/><h3>Nog geen inzichten beschikbaar</h3><p>Upload een document met tekst, datums of bedragen om de analyse te starten.</p><button className="btn btn-primary" onClick={openUpload}><UploadCloud size={17}/> Document uploaden</button></div>}
        </>}
      </main>
      <footer className="page-footer"><span>© 2026 ACTOVYNA <span className="footer-divider">/</span> Built for clarity.</span><span><ShieldCheck size={14}/> Lokale werkruimte · Geen account nodig</span><span>VERSION 1.0.0</span></footer>
    </div>

    {selectedDoc && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedDoc(null); }}><section className="document-modal" role="dialog" aria-modal="true" aria-label="Documentdetails"><div className="modal-toolbar"><div className="modal-tag"><FileText size={15}/> DOCUMENT INTELLIGENCE <span>/</span> {selectedDoc.mode.toUpperCase()}</div><button className="icon-button" aria-label="Sluit document" onClick={() => setSelectedDoc(null)}><X size={20}/></button></div><div className="modal-document-title"><DocIcon type={selectedDoc.filetype}/><div><h2>{selectedDoc.filename}</h2><p>{sizeLabel(selectedDoc.filesize)} · {dateLabel(selectedDoc.created_at)} · {selectedDoc.extracted_chars.toLocaleString('nl-BE')} tekens</p></div></div><div className="modal-scroll"><section className="detail-section"><div className="detail-head"><Sparkles size={17}/><h3>Document in het kort</h3></div><p className="summary-text">{selectedDoc.summary}</p></section><section className="detail-section"><div className="detail-head"><FileSearch size={17}/><h3>Gevonden inzichten</h3><span className="number-chip">{selectedDoc.insights.length}</span></div>{selectedDoc.insights.length ? selectedDoc.insights.map((insight, index) => <div className="detail-insight" key={index}><strong>{insight.title} · {insight.detail}</strong><p>“{insight.evidence}”</p></div>) : <p className="muted-copy">Geen expliciete datums of bedragen gevonden.</p>}</section><section className="detail-section"><div className="detail-head"><FileText size={17}/><h3>Uitgelezen brontekst</h3></div><pre className="source-text">{selectedDoc.extracted_text}</pre></section><div className="detail-warning"><Info size={17}/> Automatische herkenning kan fouten maken. Controleer datums, bedragen en verplichtingen altijd in het originele document.</div></div><div className="modal-actions"><button className="btn btn-outline danger-button" onClick={() => void removeDocument(selectedDoc.id)}><Trash2 size={16}/> Verwijderen</button><button className="btn btn-primary" onClick={() => setSelectedDoc(null)}>Gereed <Check size={16}/></button></div></section></div>}

    {taskModal && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setTaskModal(false); }}><section className="task-modal" role="dialog" aria-modal="true" aria-label="Nieuwe actie toevoegen"><div className="modal-toolbar"><span className="modal-tag"><Plus size={16}/> NIEUWE ACTIE</span><button className="icon-button" onClick={() => setTaskModal(false)} aria-label="Sluiten"><X size={20}/></button></div><h2>Maak ruimte voor <em>vooruitgang.</em></h2><p>Een kleine actie vandaag is een grote zorg minder morgen.</p><form onSubmit={event => void addTask(event)}><label>WAT MOET ER GEBEUREN?<input required maxLength={300} autoFocus value={taskTitle} onChange={event => setTaskTitle(event.target.value)} placeholder="Bijv. Aanvraagformulier indienen"/></label><label>EXTRA INFORMATIE <span>(OPTIONEEL)</span><textarea rows={3} maxLength={3000} value={taskDescription} onChange={event => setTaskDescription(event.target.value)} placeholder="Een korte toelichting voor later…"/></label><label>DEADLINE <span>(OPTIONEEL)</span><input type="date" value={taskDueDate} onChange={event => setTaskDueDate(event.target.value)}/></label><div className="modal-actions"><button className="btn btn-outline" type="button" onClick={() => setTaskModal(false)}>Annuleren</button><button className="btn btn-primary" type="submit"><Plus size={17}/> Actie toevoegen</button></div></form></section></div>}

    {toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`} role="status"><span>{toast.error ? <Info size={18}/> : <Check size={18}/>}</span><p>{toast.message}</p><button onClick={() => setToast(null)} aria-label="Sluit melding"><X size={15}/></button></div>}
    {loading && <div className="startup-overlay"><BrandMark size={58}/><span>ACTOVYNA</span><LoaderCircle className="spin" size={24}/></div>}
  </div>;
}
