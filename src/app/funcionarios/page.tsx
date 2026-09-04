"use client";

import React, { useState, useEffect } from "react";
import { auth, db, app } from "@/lib/firebase";
import { initializeApp, getApps } from "firebase/app";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User,
  getAuth,
  createUserWithEmailAndPassword
} from "firebase/auth";
import {
  collection, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, Timestamp
} from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import {
  Lock, Mail, AlertCircle, LogOut, FileSpreadsheet, FileText, FolderOpen,
  Users, Bell, Calendar as CalendarIcon, ChevronRight, Plus, ExternalLink, Home, Search,
  Settings, MessageCircle, Phone, Stethoscope, Shield, X, Maximize, Trash2,
  FileIcon, ChevronLeft, CalendarDays, Megaphone
} from "lucide-react";

/* ─── Helpers: Smart Parsing Google Drive ─── */
function parseDriveUrl(url: string) {
  if (!url) return "";
  if (url.includes('/embed') || url.includes('/preview') || url.includes('/pubhtml') || url.includes('/pub')) return url;
  
  const match = url.match(/\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
  if (match) {
    const id = match[1];
    if (url.includes('/document/')) return `https://docs.google.com/document/d/${id}/preview`;
    if (url.includes('/spreadsheets/')) return `https://docs.google.com/spreadsheets/d/${id}/preview`;
    if (url.includes('/presentation/')) return `https://docs.google.com/presentation/d/${id}/preview`;
    if (url.includes('drive.google.com/file/d/')) return `https://drive.google.com/file/d/${id}/preview`;
  }
  
  const folderMatch = url.match(/folders\/([a-zA-Z0-9-_]+)/);
  if (folderMatch) {
    return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
  }
  return url;
}

function getIconProps(url: string) {
  if (url.includes('spreadsheets')) return { icon: FileSpreadsheet, color: '#0F9D58', label: 'Excel' };
  if (url.includes('document')) return { icon: FileText, color: '#4285F4', label: 'Word' };
  if (url.includes('folders')) return { icon: FolderOpen, color: '#5F6368', label: 'Carpeta' };
  if (url.includes('presentation')) return { icon: FileIcon, color: '#F4B400', label: 'Presentación' };
  return { icon: FileText, color: '#7B2FBE', label: 'Documento' };
}

/* ─── Helpers: Calendario ─── */
const DAYS_OF_WEEK = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Ajustar para que Lunes sea 0
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/* ─── Login Screen ─── */
function LoginScreen({ onLogin }: { onLogin: (e: string, p: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try { await onLogin(email, password); } 
    catch { setError("Credenciales incorrectas. Verifica tu correo y contraseña."); } 
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F0F1E] via-[#1A1A2E] to-[#2D1B69] px-4 relative overflow-hidden">
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/[0.07] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 relative mb-4">
              <Image src="/logo.png" alt="CESFAM Rodelillo" fill sizes="80px" className="object-contain drop-shadow-lg" />
            </div>
            <h1 className="text-2xl font-black text-white font-heading">Portal Funcionarios</h1>
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-3 mb-6"><AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="text-sm">{error}</p></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Mail className="w-4 h-4 text-white/30 absolute left-4 top-1/2 -translate-y-1/2" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo institucional" required className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded-xl pl-11 pr-4 py-3 text-sm focus:border-[#7B2FBE] transition-all outline-none" />
              </div>
            </div>
            <div>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/30 absolute left-4 top-1/2 -translate-y-1/2" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" required className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded-xl pl-11 pr-4 py-3 text-sm focus:border-[#7B2FBE] transition-all outline-none" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-2 bg-[#7B2FBE] hover:bg-[#5C1FA0] text-white font-bold py-3.5 rounded-xl transition-all hover:scale-[1.02] disabled:opacity-60 shadow-lg">
              {loading ? "Ingresando..." : "Ingresar al Portal"}
            </button>
          </form>
          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-white/30 hover:text-white/60 transition-colors flex items-center justify-center gap-2">
              <Home className="w-3.5 h-3.5" /> Volver al sitio público
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Dashboard ─── */
function Dashboard({ user, userRole, onLogout }: { user: User; userRole: string; onLogout: () => void }) {
  const isAdmin = userRole === "admin" || userRole === "moderator";
  const [activeTab, setActiveTab] = useState<"avisos" | "calendario" | "documentos" | "usuarios" | "noticias_publicas">("avisos");
  
  // States Firestore
  const [documents, setDocuments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [publicNews, setPublicNews] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [searchDocQuery, setSearchDocQuery] = useState("");

  // States Modales Generales
  const [fullScreenDoc, setFullScreenDoc] = useState<any | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ title: "", description: "", url: "" });
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeForm, setNoticeForm] = useState({ content: "", isUrgent: false });
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ email: "", password: "", role: "funcionario" });
  const [userFormStatus, setUserFormStatus] = useState("");

  // States Calendario
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string>("");
  const [eventForm, setEventForm] = useState({ title: "", time: "", color: "#7B2FBE" });

  const [showPublicNoticeModal, setShowPublicNoticeModal] = useState(false);
  const [publicNoticeForm, setPublicNoticeForm] = useState({ title: "", content: "" });

  // Listeners
  useEffect(() => {
    const unsubDocs = onSnapshot(query(collection(db, "documents"), orderBy("createdAt", "desc")), snap => setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubNotices = onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), snap => setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubEvents = onSnapshot(query(collection(db, "events")), snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPublicNews = onSnapshot(query(collection(db, "public_news"), orderBy("createdAt", "desc")), snap => setPublicNews(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    let unsubUsers = () => {};
    if (isAdmin) unsubUsers = onSnapshot(collection(db, "users"), snap => setUsersList(snap.docs.map(d => ({ uid: d.id, ...d.data() }))));

    return () => { unsubDocs(); unsubNotices(); unsubEvents(); unsubPublicNews(); unsubUsers(); };
  }, [isAdmin]);

  /* ─── Acciones CRUD ─── */
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.title || !docForm.url) return;
    await addDoc(collection(db, "documents"), { ...docForm, src: docForm.url, createdAt: Timestamp.now() });
    setShowDocModal(false); setDocForm({ title: "", description: "", url: "" });
  };

  const handleAddNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeForm.content) return;
    await addDoc(collection(db, "announcements"), { content: noticeForm.content, isUrgent: noticeForm.isUrgent, author: user.email?.split("@")[0] ?? "Admin", createdAt: Timestamp.now() });
    setShowNoticeModal(false); setNoticeForm({ content: "", isUrgent: false });
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title || !selectedDateKey) return;
    await addDoc(collection(db, "events"), { title: eventForm.title, time: eventForm.time, date: selectedDateKey, color: eventForm.color, author: user.email?.split("@")[0] ?? "Admin", createdAt: Timestamp.now() });
    setShowEventModal(false); setEventForm({ title: "", time: "", color: "#7B2FBE" });
  };

  const handleAddPublicNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicNoticeForm.title || !publicNoticeForm.content) return;
    await addDoc(collection(db, "public_news"), { title: publicNoticeForm.title, content: publicNoticeForm.content, author: user.email?.split("@")[0] ?? "Admin", createdAt: Timestamp.now() });
    setShowPublicNoticeModal(false); setPublicNoticeForm({ title: "", content: "" });
  };

  const handleDelete = async (coll: string, id: string) => {
    if(confirm("¿Eliminar este elemento?")) await deleteDoc(doc(db, coll, id));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormStatus("Creando...");
    try {
      const secondaryApp = getApps().find(a => a.name === "SecondaryApp") || initializeApp(app.options!, "SecondaryApp");
      const res = await createUserWithEmailAndPassword(getAuth(secondaryApp), userForm.email, userForm.password);
      await setDoc(doc(db, "users", res.user.uid), { email: res.user.email, role: userForm.role, createdAt: Timestamp.now() });
      await getAuth(secondaryApp).signOut();
      setUserFormStatus("¡Usuario creado exitosamente!");
      setTimeout(() => { setShowUserModal(false); setUserFormStatus(""); setUserForm({ email: "", password: "", role: "funcionario" }); }, 1500);
    } catch (err: any) { setUserFormStatus("Error: " + err.message); }
  };

  /* ─── Render Helpers ─── */
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days = [];
    
    // Espacios vacios iniciales
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="bg-transparent border border-transparent p-2 h-20 md:h-28" />);
    }

    // Dias del mes
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(currentYear, currentMonth, day);
      const isToday = dateKey === formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
      const dayEvents = events.filter(e => e.date === dateKey);

      days.push(
        <div 
          key={day} 
          onClick={() => { if(isAdmin){ setSelectedDateKey(dateKey); setShowEventModal(true); } }}
          className={`border border-gray-100 p-1 md:p-2 h-20 md:h-28 overflow-hidden bg-white hover:bg-gray-50 transition-colors ${isAdmin ? 'cursor-pointer' : ''}`}
        >
          <div className={`text-[10px] md:text-xs font-bold mb-1 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#7B2FBE] text-white' : 'text-gray-500'}`}>
            {day}
          </div>
          <div className="flex flex-col gap-1">
            {dayEvents.map(evt => (
              <div key={evt.id} className="group relative text-[9px] md:text-[10px] font-semibold text-white px-1.5 py-0.5 rounded truncate" style={{ backgroundColor: evt.color }}>
                {evt.time && <span className="font-black mr-1">{evt.time}</span>}
                {evt.title}
                {isAdmin && (
                  <button onClick={(e) => { e.stopPropagation(); handleDelete("events", evt.id); }} className="absolute right-0.5 top-0.5 opacity-0 group-hover:opacity-100 bg-white/20 rounded p-0.5 hover:bg-red-500 transition-all">
                    <X className="w-2 h-2" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="min-h-screen bg-[#F8F8FC] flex flex-col">
      {/* ─── HEADER Y TABS ─── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 relative"><Image src="/logo.png" alt="Logo" fill sizes="36px" className="object-contain" /></div>
            <div className="hidden sm:block">
              <div className="font-black text-sm text-[#1A1A2E] font-heading leading-none">Intranet CESFAM</div>
            </div>
          </div>
          
          <div className="flex-1 flex justify-center overflow-x-auto hide-scrollbar">
             <div className="bg-gray-100 p-1 rounded-xl flex gap-1 min-w-max">
               <button onClick={() => setActiveTab("avisos")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'avisos' ? 'bg-white shadow-sm text-[#7B2FBE]' : 'text-gray-500 hover:text-gray-700'}`}><Megaphone className="w-4 h-4" /> Avisos</button>
               <button onClick={() => setActiveTab("calendario")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'calendario' ? 'bg-white shadow-sm text-[#7B2FBE]' : 'text-gray-500 hover:text-gray-700'}`}><CalendarDays className="w-4 h-4" /> Calendario</button>
               <button onClick={() => setActiveTab("documentos")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'documentos' ? 'bg-white shadow-sm text-[#7B2FBE]' : 'text-gray-500 hover:text-gray-700'}`}><FolderOpen className="w-4 h-4" /> Documentos</button>
               {isAdmin && (
                 <>
                   <button onClick={() => setActiveTab("noticias_publicas")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'noticias_publicas' ? 'bg-white shadow-sm text-[#7B2FBE]' : 'text-gray-500 hover:text-gray-700'}`}><Megaphone className="w-4 h-4" /> Web Pública</button>
                   <button onClick={() => setActiveTab("usuarios")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'usuarios' ? 'bg-white shadow-sm text-[#7B2FBE]' : 'text-gray-500 hover:text-gray-700'}`}><Users className="w-4 h-4" /> Usuarios</button>
                 </>
               )}
             </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={onLogout} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 font-bold transition-colors">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        
        {/* ─── PESTAÑA AVISOS ─── */}
        {activeTab === "avisos" && (
          <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black font-heading text-[#1A1A2E] flex items-center gap-2">
                <Bell className="w-6 h-6 text-[#F5C518]" /> Avisos Importantes
              </h2>
              {isAdmin && (
                <button onClick={() => setShowNoticeModal(true)} className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#7B2FBE] hover:bg-[#5C1FA0] px-3 py-2 rounded-xl transition-all shadow-md">
                  <Plus className="w-4 h-4" /> Publicar
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {announcements.length === 0 && <p className="text-sm text-gray-400 py-8 text-center bg-white rounded-3xl border border-gray-100">No hay avisos recientes.</p>}
              {announcements.map((notice) => (
                <div key={notice.id} className={`p-6 rounded-3xl relative group border ${notice.isUrgent ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 shadow-sm'}`}>
                  {isAdmin && (
                    <button onClick={() => handleDelete("announcements", notice.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {notice.isUrgent && <span className="inline-block text-[10px] font-black uppercase text-red-600 bg-red-100 px-3 py-1 rounded-lg mb-3">🔴 Urgente</span>}
                  <p className={`text-base leading-relaxed mb-4 ${notice.isUrgent ? 'text-red-900 font-medium' : 'text-[#1A1A2E]'}`}>{notice.content}</p>
                  <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                    <span>Publicado por: {notice.author}</span>
                    <span>{notice.createdAt?.toDate().toLocaleDateString('es-CL')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── PESTAÑA CALENDARIO ─── */}
        {activeTab === "calendario" && (
          <div className="grid lg:grid-cols-12 gap-8 animate-fade-in">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black font-heading text-[#1A1A2E] flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-[#5CB85C]" /> Calendario Institucional
                  </h2>
                  <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-xl">
                    <button onClick={() => setCurrentMonth(prev => prev === 0 ? 11 : prev - 1)} className="text-gray-400 hover:text-[#7B2FBE]"><ChevronLeft className="w-5 h-5" /></button>
                    <span className="text-sm font-bold w-24 text-center">{MONTHS[currentMonth]} {currentYear}</span>
                    <button onClick={() => setCurrentMonth(prev => prev === 11 ? 0 : prev + 1)} className="text-gray-400 hover:text-[#7B2FBE]"><ChevronRight className="w-5 h-5" /></button>
                  </div>
                </div>

                {/* Grid Header */}
                <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
                  {DAYS_OF_WEEK.map(d => <div key={d} className="text-center text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">{d}</div>)}
                </div>
                {/* Grid Body */}
                <div className="grid grid-cols-7 gap-1 md:gap-2">
                  {renderCalendar()}
                </div>
                {isAdmin && <p className="text-[10px] text-gray-400 mt-4 text-center">Haz clic en cualquier día para agendar un evento o actividad.</p>}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              {/* SAPU Info - Small Banner */}
              <div className="bg-gradient-to-r from-[#1A1A2E] to-[#2D1B69] rounded-3xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg mb-1">🚨 Horario SAPU</h3>
                    <p className="text-white/60 text-sm">Atención Primaria de Urgencia</p>
                  </div>
                </div>
                <div className="bg-white/10 rounded-2xl p-4 text-center">
                  <div className="text-[#F5C518] font-black text-2xl mb-1">17:00 – 00:00</div>
                  <div className="text-white/80 text-sm font-medium">Lunes a Viernes</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── PESTAÑA DOCUMENTOS ─── */}
        {activeTab === "documentos" && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black font-heading text-[#1A1A2E]">Biblioteca de Documentos</h2>
                <p className="text-sm text-gray-500 mt-1">Acceso directo a planillas, protocolos y archivos compartidos de Google Drive.</p>
              </div>
              {isAdmin && (
                <button onClick={() => setShowDocModal(true)} className="flex items-center gap-1.5 text-sm font-bold text-white bg-[#7B2FBE] hover:bg-[#5C1FA0] px-5 py-2.5 rounded-xl transition-all shadow-md">
                  <Plus className="w-5 h-5" /> Vincular Drive
                </button>
              )}
            </div>

            <div className="relative max-w-xl mb-8">
              <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Buscar por título o descripción..." value={searchDocQuery} onChange={e => setSearchDocQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:border-[#7B2FBE] focus:ring-2 focus:ring-purple-100 outline-none transition-all" />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {documents.filter(d => d.title.toLowerCase().includes(searchDocQuery.toLowerCase()) || d.description?.toLowerCase().includes(searchDocQuery.toLowerCase())).map(docData => {
                const parsedUrl = parseDriveUrl(docData.src);
                const uiProps = getIconProps(docData.src);
                return (
                  <div key={docData.id} className="bg-white border border-gray-100 rounded-3xl p-5 hover:shadow-xl hover:-translate-y-1 hover:border-[#7B2FBE]/30 transition-all group cursor-pointer relative" onClick={() => setFullScreenDoc({ ...docData, parsedUrl })}>
                    {isAdmin && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete("documents", docData.id); }} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${uiProps.color}15`, color: uiProps.color }}>
                      <uiProps.icon className="w-7 h-7" />
                    </div>
                    <div className="font-bold text-[#1A1A2E] text-lg leading-tight mb-2">{docData.title}</div>
                    <div className="text-gray-400 text-sm line-clamp-2 mb-6 min-h-[40px]">{docData.description}</div>
                    <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl bg-gray-50 text-gray-500">{uiProps.label}</span>
                      <span className="text-sm text-[#7B2FBE] font-black flex items-center gap-1.5 group-hover:underline">Abrir visor <Maximize className="w-3.5 h-3.5" /></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── PESTAÑA USUARIOS ─── */}
        {activeTab === "usuarios" && isAdmin && (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm animate-fade-in">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black font-heading text-[#1A1A2E]">Directorio y Permisos</h2>
                <p className="text-sm text-gray-500 mt-1">Administra los accesos al portal interno.</p>
              </div>
              <button onClick={() => setShowUserModal(true)} className="flex items-center gap-2 bg-[#7B2FBE] hover:bg-[#5C1FA0] text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-md">
                <Users className="w-5 h-5" /> Registrar Usuario
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-4 px-6">Correo Institucional</th>
                    <th className="py-4 px-6">Rol Actual</th>
                    <th className="py-4 px-6">Registro</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {usersList.map(u => (
                    <tr key={u.uid} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6 font-semibold text-[#1A1A2E]">{u.email}</td>
                      <td className="py-4 px-6">
                        <select 
                          value={u.role} 
                          onChange={(e) => updateDoc(doc(db, "users", u.uid), { role: e.target.value })}
                          className={`text-xs font-black uppercase tracking-wide px-4 py-2 rounded-xl outline-none cursor-pointer transition-colors ${u.role === 'admin' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="funcionario">Funcionario</option>
                        </select>
                      </td>
                      <td className="py-4 px-6 text-gray-400 text-xs font-medium">
                        {u.createdAt ? u.createdAt.toDate().toLocaleDateString('es-CL') : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* ─── PESTAÑA NOTICIAS PÚBLICAS ─── */}
        {activeTab === "noticias_publicas" && isAdmin && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black font-heading text-[#1A1A2E]">Noticias Sitio Público</h2>
                <p className="text-sm text-gray-500 mt-1">Lo que publiques aquí aparecerá directamente a los pacientes en la página principal.</p>
              </div>
              <button onClick={() => setShowPublicNoticeModal(true)} className="flex items-center gap-1.5 text-sm font-bold text-white bg-[#7B2FBE] hover:bg-[#5C1FA0] px-5 py-2.5 rounded-xl transition-all shadow-md">
                <Plus className="w-5 h-5" /> Nueva Noticia
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {publicNews.length === 0 && <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-3xl border border-gray-100">No hay noticias públicas publicadas.</div>}
              {publicNews.map(news => (
                <div key={news.id} className="bg-white border border-gray-100 rounded-3xl p-6 hover:shadow-xl transition-all relative group">
                  <button onClick={() => handleDelete("public_news", news.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <h3 className="font-black text-xl text-[#1A1A2E] mb-3 pr-6">{news.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-4 mb-4 whitespace-pre-wrap">{news.content}</p>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{news.createdAt?.toDate().toLocaleDateString('es-CL')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ─── THEATER MODE ─── */}
      {fullScreenDoc && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-xl animate-fade-in">
          <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 shrink-0">
            <div className="text-white font-bold text-lg truncate flex items-center gap-3">
              {(() => { const IconCmp = getIconProps(fullScreenDoc.src).icon; return <IconCmp className="w-6 h-6 text-[#F5C518]" />; })()}
              {fullScreenDoc.title}
            </div>
            <div className="flex items-center gap-6">
              <a href={fullScreenDoc.src} target="_blank" rel="noreferrer" className="text-sm font-bold text-white/70 hover:text-white flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-all">
                Abrir en Drive original <ExternalLink className="w-4 h-4" />
              </a>
              <button onClick={() => setFullScreenDoc(null)} className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-red-500 rounded-full text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          <div className="flex-1 w-full h-full p-4 md:p-8">
             <div className="w-full h-full bg-white rounded-3xl overflow-hidden shadow-2xl">
               <iframe src={fullScreenDoc.parsedUrl} className="w-full h-full border-0" title={fullScreenDoc.title} />
             </div>
          </div>
        </div>
      )}

      {/* ─── MODALES DE FORMULARIOS ─── */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-fade-up">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black font-heading text-[#1A1A2E]">Enlazar Drive</h3>
              <button onClick={() => setShowDocModal(false)}><X className="w-6 h-6 text-gray-400 hover:text-red-500" /></button>
            </div>
            <form onSubmit={handleAddDocument} className="space-y-5">
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Título</label><input type="text" required value={docForm.title} onChange={e => setDocForm({...docForm, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-[#7B2FBE] outline-none" /></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Descripción (Opcional)</label><input type="text" value={docForm.description} onChange={e => setDocForm({...docForm, description: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-[#7B2FBE] outline-none" /></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Enlace Compartido</label><input type="url" required value={docForm.url} onChange={e => setDocForm({...docForm, url: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-[#7B2FBE] outline-none" /></div>
              <button type="submit" className="w-full bg-[#7B2FBE] hover:bg-[#5C1FA0] text-white font-bold py-3.5 rounded-xl mt-4">Guardar Documento</button>
            </form>
          </div>
        </div>
      )}

      {showNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-fade-up">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black font-heading text-[#1A1A2E]">Nuevo Aviso</h3>
              <button onClick={() => setShowNoticeModal(false)}><X className="w-6 h-6 text-gray-400 hover:text-red-500" /></button>
            </div>
            <form onSubmit={handleAddNotice} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mensaje del Anuncio</label>
                <textarea required rows={5} value={noticeForm.content} onChange={e => setNoticeForm({...noticeForm, content: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-[#7B2FBE] outline-none resize-none" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer bg-red-50 p-4 rounded-xl border border-red-100">
                <input type="checkbox" checked={noticeForm.isUrgent} onChange={e => setNoticeForm({...noticeForm, isUrgent: e.target.checked})} className="w-5 h-5 text-red-600 rounded" />
                <span className="font-bold text-red-900">Aviso Urgente (Destacado en Rojo)</span>
              </label>
              <button type="submit" className="w-full bg-[#7B2FBE] hover:bg-[#5C1FA0] text-white font-bold py-3.5 rounded-xl">Publicar al Equipo</button>
            </form>
          </div>
        </div>
      )}

      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-fade-up">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black font-heading text-[#1A1A2E]">Agendar Evento</h3>
              <button onClick={() => setShowEventModal(false)}><X className="w-6 h-6 text-gray-400 hover:text-red-500" /></button>
            </div>
            <p className="text-sm font-bold text-[#7B2FBE] bg-purple-50 px-4 py-2 rounded-lg mb-6 text-center">Para el día: {selectedDateKey}</p>
            <form onSubmit={handleAddEvent} className="space-y-5">
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Título del Evento</label><input type="text" required value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-[#7B2FBE] outline-none" placeholder="Ej: Capacitación MINSAL" /></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Hora (Opcional)</label><input type="time" value={eventForm.time} onChange={e => setEventForm({...eventForm, time: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-[#7B2FBE] outline-none" /></div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Color Etiqueta</label>
                <div className="flex gap-3">
                  {["#7B2FBE", "#5CB85C", "#F5C518", "#E11D48", "#2563EB"].map(c => (
                    <button key={c} type="button" onClick={() => setEventForm({...eventForm, color: c})} className={`w-8 h-8 rounded-full border-2 transition-all ${eventForm.color === c ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full bg-[#7B2FBE] hover:bg-[#5C1FA0] text-white font-bold py-3.5 rounded-xl mt-4">Guardar en Calendario</button>
            </form>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-fade-up">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black font-heading text-[#1A1A2E]">Registrar Funcionario</h3>
              <button onClick={() => setShowUserModal(false)}><X className="w-6 h-6 text-gray-400 hover:text-red-500" /></button>
            </div>
            {userFormStatus && <div className="mb-6 text-center text-sm font-bold text-[#7B2FBE] bg-purple-50 py-3 rounded-xl">{userFormStatus}</div>}
            <form onSubmit={handleCreateUser} className="space-y-5">
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Correo Electrónico</label><input type="email" required value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-[#7B2FBE] outline-none" /></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Contraseña Provisoria</label><input type="password" required value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-[#7B2FBE] outline-none" minLength={6} /></div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Rol Inicial</label>
                <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-[#7B2FBE] outline-none font-bold">
                  <option value="funcionario">Funcionario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-[#7B2FBE] hover:bg-[#5C1FA0] text-white font-bold py-3.5 rounded-xl mt-4">Crear Cuenta</button>
            </form>
          </div>
        </div>
      )}

      {showPublicNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-fade-up">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black font-heading text-[#1A1A2E]">Noticia para Pacientes</h3>
              <button onClick={() => setShowPublicNoticeModal(false)}><X className="w-6 h-6 text-gray-400 hover:text-red-500" /></button>
            </div>
            <form onSubmit={handleAddPublicNotice} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Título Atractivo</label>
                <input type="text" required value={publicNoticeForm.title} onChange={e => setPublicNoticeForm({...publicNoticeForm, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-[#7B2FBE] outline-none font-bold text-lg" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Cuerpo de la Noticia</label>
                <textarea required rows={6} value={publicNoticeForm.content} onChange={e => setPublicNoticeForm({...publicNoticeForm, content: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-[#7B2FBE] outline-none resize-none" placeholder="Escribe el anuncio público..." />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-[#7B2FBE] to-[#5CB85C] hover:scale-[1.02] transition-transform text-white font-black py-4 rounded-xl shadow-lg mt-4">
                Publicar en la Web Principal
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ENRUTADOR ─── */
export default function FuncionariosPortal() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>("funcionario");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async currentUser => {
      if (currentUser) {
        setUser(currentUser);
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserRole(userSnap.data().role || "funcionario");
        } else {
          const isMasterAdmin = currentUser.email === "ssanchez@cmvalparaiso.cl";
          const newRole = isMasterAdmin ? "admin" : "funcionario";
          await setDoc(userRef, { email: currentUser.email, role: newRole, createdAt: Timestamp.now() });
          setUserRole(newRole);
        }
      } else {
        setUser(null);
        setUserRole("funcionario");
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0F0F1E] flex flex-col items-center justify-center gap-4"><div className="w-16 h-16 relative"><Image src="/logo.png" alt="Cargando" fill sizes="64px" className="object-contain animate-pulse" /></div><p className="text-white/40 text-sm font-medium">Validando acceso...</p></div>;
  if (!user) return <LoginScreen onLogin={(e, p) => signInWithEmailAndPassword(auth, e, p).then()} />;
  return <Dashboard user={user} userRole={userRole} onLogout={() => signOut(auth)} />;
}
