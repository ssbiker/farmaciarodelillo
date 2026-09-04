"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Megaphone, Calendar } from 'lucide-react';

export function News() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'public_news'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setNews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading || news.length === 0) return null;

  return (
    <section className="py-24 bg-gradient-to-b from-white to-[#F8F8FC] relative overflow-hidden" id="noticias">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="text-center mb-16 animate-fade-up">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 font-bold rounded-full text-sm mb-4">
            <Megaphone className="w-4 h-4" /> Actualidad CESFAM
          </span>
          <h2 className="text-4xl md:text-5xl font-black font-heading text-[#1A1A2E] mb-4">
            Noticias y <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7B2FBE] to-[#5CB85C]">Avisos a la Comunidad</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Mantente informado sobre las últimas campañas, operativos y anuncios importantes de nuestro centro de salud.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {news.map((item, i) => (
            <div 
              key={item.id} 
              className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgb(123,47,190,0.1)] transition-all duration-300 group relative overflow-hidden animate-fade-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#7B2FBE] via-[#5CB85C] to-[#F5C518] transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-400 mb-6">
                  <Calendar className="w-4 h-4 text-[#7B2FBE]" />
                  <span>{item.createdAt?.toDate().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                
                <h3 className="text-2xl font-black font-heading text-[#1A1A2E] mb-4 leading-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-br group-hover:from-[#7B2FBE] group-hover:to-[#1A1A2E] transition-all">
                  {item.title}
                </h3>
                
                <p className="text-gray-500 leading-relaxed text-sm whitespace-pre-wrap">
                  {item.content}
                </p>
              </div>
              
              <Megaphone className="w-32 h-32 absolute -bottom-6 -right-6 text-gray-50/50 transform -rotate-12 group-hover:scale-110 group-hover:text-purple-50/50 transition-all duration-500 z-0" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
