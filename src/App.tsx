import React, { useState, useEffect, useCallback } from "react";
import { 
  Settings, 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Search,
  ArrowRight,
  Loader2,
  ExternalLink,
  LayoutDashboard,
  FileCode,
  Zap,
  Box
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description: string;
    created: string;
    issuetype: { name: string };
    status: { name: string };
    priority: { name: string };
    reporter: { displayName: string };
    assignee: { displayName: string } | null;
    comment?: {
      comments: Array<{
        author: { displayName: string };
        body: string;
        created: string;
      }>;
    };
    issuelinks?: Array<{
      type: { inward: string; outward: string };
      outwardIssue?: { key: string; fields: { summary: string } };
      inwardIssue?: { key: string; fields: { summary: string } };
    }>;
    [key: string]: any; // For custom fields
  };
}

interface SyncStatus {
  total: number;
  processed: number;
  currentIssue: string;
  isSyncing: boolean;
  error: string | null;
  logs: string[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "search" | "config" | "rules">("dashboard");
  const [projectKey, setProjectKey] = useState(() => localStorage.getItem("jira_project_key") || process.env.VITE_JIRA_PROJECT_KEY || "");
  const [issueTypes, setIssueTypes] = useState(() => localStorage.getItem("jira_issue_types") || process.env.VITE_JIRA_ISSUE_TYPE || "Błąd w programie, Zadanie, Incydent");
  const [collectionName, setCollectionName] = useState(() => localStorage.getItem("qdrant_collection") || process.env.VITE_QDRANT_COLLECTION_NAME || "jira_issues");
  const [lastSyncDate, setLastSyncDate] = useState(() => localStorage.getItem("last_sync_date") || "");
  const [fullSync, setFullSync] = useState(false);

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem("jira_project_key", projectKey);
  }, [projectKey]);

  useEffect(() => {
    localStorage.setItem("jira_issue_types", issueTypes);
  }, [issueTypes]);

  useEffect(() => {
    localStorage.setItem("qdrant_collection", collectionName);
  }, [collectionName]);

  useEffect(() => {
    if (lastSyncDate) localStorage.setItem("last_sync_date", lastSyncDate);
  }, [lastSyncDate]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [status, setStatus] = useState<SyncStatus>({
    total: 0,
    processed: 0,
    currentIssue: "",
    isSyncing: false,
    error: null,
    logs: []
  });

  // Poll sync status from backend
  useEffect(() => {
    let interval: any;
    if (status.isSyncing) {
      interval = setInterval(async () => {
        try {
          const res = await fetch("/api/sync/status");
          const data = await res.json();
          setStatus(data);
        } catch (error) {
          console.error("Status poll error:", error);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [status.isSyncing]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: searchQuery, 
          collection: collectionName,
          limit: 10 
        })
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (error: any) {
      console.error("Search error:", error);
      setStatus(prev => ({ ...prev, error: `Search failed: ${error.message}` }));
    } finally {
      setIsSearching(false);
    }
  };

  const startSync = async () => {
    if (!projectKey || !issueTypes) {
      setStatus(prev => ({ ...prev, error: "Project Key and Issue Types are required." }));
      return;
    }

    try {
      const typesArray = issueTypes.split(",").map(t => t.trim()).filter(t => t);
      
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: projectKey,
          issueTypes: typesArray,
          collection: collectionName,
          updatedAfter: fullSync ? undefined : lastSyncDate
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setStatus(prev => ({ ...prev, isSyncing: true, logs: ["Sync request sent to backend..."] }));
    } catch (error: any) {
      console.error("Sync trigger error:", error);
      setStatus(prev => ({ ...prev, error: error.message }));
    }
  };

  return (
    <div className="flex min-h-screen bg-bg-main text-text-main font-sans">
      {/* Sidebar */}
      <aside className="w-[260px] bg-sidebar border-r border-border-main flex flex-col p-6 shrink-0">
        <div className="flex items-center gap-2.5 text-primary-main font-extrabold text-xl mb-10">
          <Box className="w-6 h-6" />
          VectorLink
        </div>
        
        <nav className="space-y-8">
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-text-muted font-bold mb-3">Zarządzanie</span>
            <div className="space-y-1">
              <button 
                onClick={() => setActiveTab("dashboard")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === 'dashboard' ? 'bg-blue-50 text-primary-main font-semibold' : 'text-text-main hover:bg-slate-50'}`}
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
              <button 
                onClick={() => setActiveTab("search")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === 'search' ? 'bg-blue-50 text-primary-main font-semibold' : 'text-text-main hover:bg-slate-50'}`}
              >
                <Search className="w-4 h-4" /> Eksplorator Wektorów
              </button>
              <button 
                onClick={() => setActiveTab("config")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === 'config' ? 'bg-blue-50 text-primary-main font-semibold' : 'text-text-main hover:bg-slate-50'}`}
              >
                <Settings className="w-4 h-4" /> Konfiguracja API
              </button>
              <button 
                onClick={() => setActiveTab("rules")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === 'rules' ? 'bg-blue-50 text-primary-main font-semibold' : 'text-text-main hover:bg-slate-50'}`}
              >
                <FileCode className="w-4 h-4" /> Zasady Parsowania
              </button>
            </div>
          </div>

          <div>
            <span className="block text-[10px] uppercase tracking-wider text-text-muted font-bold mb-3">Integracje</span>
            <div className="space-y-1">
              <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-main hover:bg-slate-50 transition-colors text-sm">
                <Zap className="w-4 h-4" /> Jira SD (v8.20)
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-main hover:bg-slate-50 transition-colors text-sm">
                <Database className="w-4 h-4" /> Qdrant DB
              </a>
            </div>
          </div>
        </nav>

        <div className="mt-auto bg-slate-50 p-4 rounded-xl border border-border-main">
          <div className="font-bold text-[11px] text-text-main mb-1">Proxmox Container</div>
          <div className="text-[10px] text-text-muted leading-relaxed">
            ID: 104 (LXC) • Node: pve-01<br />
            CPU: 12% • RAM: 450MB / 2GB
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 flex flex-col gap-6 overflow-y-auto">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              {activeTab === 'dashboard' ? 'Dashboard Indeksowania' : 
               activeTab === 'search' ? 'Eksplorator Wektorów' :
               activeTab === 'config' ? 'Konfiguracja API' : 'Zasady Parsowania'}
            </h1>
            <p className="text-sm text-text-muted">
              {activeTab === 'dashboard' ? 'Monitorowanie procesu wektoryzacji zgłoszeń Jira' : 
               activeTab === 'search' ? 'Przeszukiwanie semantyczne bazy wiedzy' :
               activeTab === 'config' ? 'Zarządzanie połączeniami z usługami zewnętrznymi' : 'Definiowanie struktury danych wektorowych'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 text-success-main px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border border-emerald-100">
              <div className="w-2 h-2 bg-success-main rounded-full animate-pulse" />
              System Aktywny
            </div>
            {activeTab === 'dashboard' && (
              <button 
                onClick={startSync}
                disabled={status.isSyncing}
                className="bg-primary-main hover:bg-primary-hover text-white px-5 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              >
                {status.isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Uruchom Sync
              </button>
            )}
          </div>
        </header>

        {activeTab === 'dashboard' ? (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-5">
              <div className="bg-sidebar p-5 rounded-xl border border-border-main shadow-sm">
                <p className="text-[11px] text-text-muted mb-2 font-medium">Zgłoszenia Jira</p>
                <p className="text-2xl font-bold">{status.total.toLocaleString()}</p>
              </div>
              <div className="bg-sidebar p-5 rounded-xl border border-border-main shadow-sm">
                <p className="text-[11px] text-text-muted mb-2 font-medium">Przetworzone</p>
                <p className="text-2xl font-bold">{status.processed.toLocaleString()}</p>
              </div>
              <div className="bg-sidebar p-5 rounded-xl border border-border-main shadow-sm">
                <p className="text-[11px] text-text-muted mb-2 font-medium">Ostatni przebieg</p>
                <p className="text-2xl font-bold text-sm mt-2">12 min temu</p>
              </div>
              <div className="bg-sidebar p-5 rounded-xl border border-border-main shadow-sm">
                <p className="text-[11px] text-text-muted mb-2 font-medium">Średni czas/issue</p>
                <p className="text-2xl font-bold">1.2s</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
              {/* Configuration Section */}
              <div className="col-span-1 flex flex-col gap-6">
                <section className="bg-sidebar p-6 rounded-xl border border-border-main shadow-sm flex flex-col h-full">
                  <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary-main" />
                    Parametry bazy wiedzy
                  </h3>
                  
                  <div className="space-y-4 flex-1">
                    <div className="flex flex-col gap-1.5 py-3 border-b border-border-main">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Jira Project Key</label>
                      <input 
                        type="text" 
                        value={projectKey}
                        onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                        className="w-full bg-slate-50 border border-border-main rounded px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-primary-main outline-none"
                        placeholder="np. SD"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 py-3 border-b border-border-main">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Typy Zgłoszeń (Issue Types)</label>
                      <input 
                        type="text" 
                        value={issueTypes}
                        onChange={(e) => setIssueTypes(e.target.value)}
                        className="w-full bg-slate-50 border border-border-main rounded px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-primary-main outline-none"
                        placeholder="np. Błąd, Zadanie"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 py-3 border-b border-border-main">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Kolekcja Qdrant</label>
                      <input 
                        type="text" 
                        value={collectionName}
                        onChange={(e) => setCollectionName(e.target.value)}
                        className="w-full bg-slate-50 border border-border-main rounded px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-primary-main outline-none"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between py-3 border-b border-border-main">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Pełna synchronizacja</span>
                        <span className="text-[9px] text-text-muted">Zignoruj datę ostatniej synchronizacji</span>
                      </div>
                      <button 
                        onClick={() => setFullSync(!fullSync)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${fullSync ? 'bg-primary-main' : 'bg-slate-200'}`}
                      >
                        <motion.div 
                          className="absolute top-1 w-3 h-3 bg-white rounded-full"
                          animate={{ left: fullSync ? '24px' : '4px' }}
                        />
                      </button>
                    </div>

                    {lastSyncDate && !fullSync && (
                      <div className="py-3 border-b border-border-main">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Ostatnia synchronizacja</label>
                        <div className="text-[11px] font-mono text-primary-main mt-1">{lastSyncDate}</div>
                      </div>
                    )}

                    <div className="flex justify-between py-3 text-xs">
                      <span className="text-text-muted">Model Embeddingów</span>
                      <span className="font-bold text-primary-main">Local (MiniLM-L6)</span>
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="flex justify-between text-[11px] font-bold mb-2">
                      <span className="text-text-muted uppercase tracking-wider">Postęp skanowania</span>
                      <span className="text-primary-main">{status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-primary-main"
                        initial={{ width: 0 }}
                        animate={{ width: `${status.total > 0 ? (status.processed / status.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </section>

                {status.error && (
                  <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-xs text-red-600 flex gap-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {status.error}
                  </div>
                )}
              </div>

              {/* Logs Section */}
              <div className="col-span-2 flex flex-col">
                <section className="bg-slate-900 rounded-xl p-6 shadow-xl flex flex-col h-full min-h-[400px]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <RefreshCw className={`w-4 h-4 text-sky-400 ${status.isSyncing ? 'animate-spin' : ''}`} />
                      Live Engine Logs
                    </h3>
                    {status.currentIssue && (
                      <span className="text-[10px] font-mono text-sky-400 animate-pulse">
                        Processing: {status.currentIssue}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 font-mono text-[11px] text-slate-400 overflow-y-auto space-y-1.5 custom-scrollbar pr-2">
                    <AnimatePresence initial={false}>
                      {status.logs.length === 0 ? (
                        <div className="opacity-20 italic py-4">System idle. Waiting for sync command...</div>
                      ) : (
                        status.logs.map((log, i) => (
                          <motion.div 
                            key={i}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex gap-3 items-start"
                          >
                            <span className="text-slate-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                            <span className={
                              log.startsWith('Error') ? 'text-rose-400' : 
                              log.includes('SUCCESS') || log.includes('completed') ? 'text-emerald-400' : 
                              'text-slate-300'
                            }>
                              {log}
                            </span>
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </section>
              </div>
            </div>
          </>
        ) : activeTab === 'search' ? (
          <div className="flex-1 flex flex-col gap-6">
            <section className="bg-sidebar p-8 rounded-xl border border-border-main shadow-sm">
              <form onSubmit={handleSearch} className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Zadaj pytanie dotyczące zgłoszeń (np. 'Jakie były problemy z bazą danych w zeszłym tygodniu?')..."
                    className="w-full bg-slate-50 border border-border-main rounded-xl pl-12 pr-4 py-4 text-sm focus:ring-2 focus:ring-primary-main outline-none transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-primary-main hover:bg-primary-hover text-white px-8 py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Szukaj
                </button>
              </form>
            </section>

            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {searchResults.length === 0 && !isSearching ? (
                  <div className="flex flex-col items-center justify-center py-20 text-text-muted opacity-40">
                    <Search className="w-12 h-12 mb-4" />
                    <p className="text-sm italic">Brak wyników. Wpisz zapytanie powyżej.</p>
                  </div>
                ) : (
                  searchResults.map((result, i) => (
                    <motion.div 
                      key={result.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-sidebar p-6 rounded-xl border border-border-main shadow-sm hover:border-primary-main/30 transition-colors group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <span className="bg-blue-50 text-primary-main px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                            {result.payload.issue_key}
                          </span>
                          <h4 className="font-bold text-lg">{result.payload.summary}</h4>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            result.payload.chunk_type === 'main' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {result.payload.chunk_type}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-text-muted bg-slate-50 px-2 py-1 rounded">
                          Score: {Math.round(result.score * 100)}%
                        </span>
                      </div>
                      <div className="text-sm text-text-muted mb-4 leading-relaxed bg-slate-50/50 p-3 rounded-lg border border-slate-100 italic">
                        "{result.payload.text}"
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-text-muted font-medium uppercase tracking-widest">
                        <div className="flex gap-4">
                          <span>Status: {result.payload.status}</span>
                          <span>Typ: {result.payload.issue_type}</span>
                          <span>Priorytet: {result.payload.priority}</span>
                          <span>Aktualizacja: {new Date(result.payload.updated).toLocaleDateString()}</span>
                        </div>
                        <button className="text-primary-main opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          Otwórz w Jira <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : activeTab === 'config' ? (
          <div className="bg-sidebar rounded-xl border border-border-main shadow-sm p-8 flex flex-col gap-6 flex-1">
            <div className="max-w-2xl">
              <h3 className="text-lg font-bold mb-2">Konfiguracja Połączeń API</h3>
              <p className="text-sm text-text-muted mb-8">Status połączeń z usługami zewnętrznymi skonfigurowanymi w pliku .env.</p>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-border-main flex justify-between items-center">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase">Jira Instance</label>
                      <div className="text-sm font-mono mt-1">{process.env.VITE_JIRA_URL || "https://jira.example.com"}</div>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1 rounded-full">
                      <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full" /> Połączono
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-xl border border-border-main flex justify-between items-center">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase">Qdrant Vector DB</label>
                      <div className="text-sm font-mono mt-1">{process.env.VITE_QDRANT_URL || "http://192.168.1.28:6333"}</div>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1 rounded-full">
                      <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full" /> Połączono
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-border-main flex justify-between items-center">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase">Lokalny Silnik AI</label>
                      <div className="text-sm font-mono mt-1">Transformers.js / all-MiniLM-L6-v2</div>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1 rounded-full">
                      <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full" /> Aktywny (Local)
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800 text-xs leading-relaxed">
                  <strong>Informacja:</strong> Zmiana adresów URL i kluczy API wymaga edycji pliku <code>.env</code> na serwerze Proxmox i restartu usługi <code>pm2 restart jira-sync</code>.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-sidebar rounded-xl border border-border-main shadow-sm p-8 flex flex-col gap-6 flex-1">
            <div className="max-w-2xl">
              <h3 className="text-lg font-bold mb-2">Zasady Parsowania i Indeksowania</h3>
              <p className="text-sm text-text-muted mb-8">Definiuj, jakie dane ze zgłoszeń Jira są przekształcane na wektory i zapisywane w bazie.</p>
              
              <div className="space-y-4">
                {[
                  { name: 'Klucz (Key)', desc: 'Unikalny identyfikator zgłoszenia (np. MFP-123)' },
                  { name: 'Tytuł (Summary)', desc: 'Krótki opis problemu' },
                  { name: 'Opis (Description)', desc: 'Pełna treść zgłoszenia' },
                  { name: 'Komentarze', desc: 'Historia dyskusji pod zgłoszeniem' },
                  { name: 'Linki (Issue Links)', desc: 'Powiązania z innymi zadaniami' },
                  { name: 'Pola Niestandardowe', desc: 'Wszystkie pola typu customfield_XXXXX' }
                ].map((field) => (
                  <div key={field.name} className="flex items-center justify-between p-4 bg-white rounded-xl border border-border-main shadow-sm">
                    <div>
                      <div className="text-sm font-bold">{field.name}</div>
                      <div className="text-[11px] text-text-muted">{field.desc}</div>
                    </div>
                    <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                      <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
        }
      `}} />
    </div>
  );
}
