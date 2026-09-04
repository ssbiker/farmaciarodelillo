"use client";

import Image from "next/image";
import { Clock, AlertTriangle, MessageCircle, CalendarDays } from "lucide-react";

export function CecosfSection() {
  return (
    <section id="cecosf" className="py-20 bg-gray-50 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-gradient-to-br from-purple-100/40 to-blue-50/40 blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-gradient-to-tr from-amber-50/50 to-orange-50/50 blur-3xl -z-10" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden p-8 md:p-12 lg:p-16 max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            
            {/* Left side: Logo and Intro */}
            <div className="w-full lg:w-1/3 flex flex-col items-center lg:items-start text-center lg:text-left">
              <div className="w-48 h-48 md:w-56 md:h-56 relative mb-8 rounded-full bg-white shadow-md border border-gray-50 p-4">
                <Image 
                  src="/images/logotipo-cecosf.png"
                  alt="CECOSF Juan Pablo II Logo"
                  fill
                  className="object-contain p-4"
                />
              </div>
              <h2 className="text-3xl md:text-4xl font-black font-heading text-[#1A1A2E] mb-4 leading-tight">
                CECOSF <br/><span className="text-[#7B2FBE]">Juan Pablo II</span>
              </h2>
              <p className="text-gray-500 mb-8 max-w-sm">
                Información de atención, horarios de farmacia y contacto directo para nuestra comunidad.
              </p>
              
              <a 
                href="https://wa.me/56964529540" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3.5 px-8 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 w-full justify-center lg:w-auto lg:justify-start group"
              >
                <MessageCircle className="w-6 h-6 animate-pulse" />
                <span>WhatsApp Consultas</span>
              </a>
            </div>

            {/* Right side: Schedules and Alerts */}
            <div className="w-full lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Horario SOME */}
              <div className="bg-blue-50/50 rounded-3xl p-6 border border-blue-100/50 hover:bg-blue-50 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-blue-900 text-lg">Horario SOME</h3>
                </div>
                <div className="space-y-3 text-sm text-blue-800">
                  <div className="flex flex-col">
                    <span className="font-bold">Lunes a Jueves:</span>
                    <span>08:00 a 14:00 Hrs<br/>15:00 a 17:00 Hrs</span>
                  </div>
                  <div className="h-px bg-blue-200/50" />
                  <div className="flex flex-col">
                    <span className="font-bold">Viernes:</span>
                    <span>08:00 a 14:00 Hrs<br/>15:00 a 16:00 Hrs</span>
                  </div>
                </div>
              </div>

              {/* Horario Farmacia */}
              <div className="bg-purple-50/50 rounded-3xl p-6 border border-purple-100/50 hover:bg-purple-50 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-[#7B2FBE]">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-purple-900 text-lg">Farmacia</h3>
                </div>
                <div className="space-y-3 text-sm text-purple-800">
                  <div className="flex flex-col">
                    <span className="font-bold">Lunes a Jueves:</span>
                    <span>08:00 a 13:00 Hrs<br/>14:00 a 17:00 Hrs</span>
                  </div>
                  <div className="h-px bg-purple-200/50" />
                  <div className="flex flex-col">
                    <span className="font-bold">Viernes:</span>
                    <span>08:00 a 13:00 Hrs<br/>14:00 a 16:00 Hrs</span>
                  </div>
                </div>
              </div>

              {/* Cierre Farmacia */}
              <div className="bg-amber-50/50 rounded-3xl p-6 border border-amber-200/50 hover:bg-amber-50 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-amber-900 text-lg leading-tight">Cierre de Farmacia</h3>
                </div>
                <p className="text-amber-800 text-sm font-medium">
                  Último Lunes del Mes por Inventario.
                </p>
              </div>

              {/* Cierres Anticipados */}
              <div className="bg-orange-50/50 rounded-3xl p-6 border border-orange-200/50 hover:bg-orange-50 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-orange-900 text-lg leading-tight">Cierres Anticipados</h3>
                </div>
                <p className="text-orange-800 text-sm font-medium">
                  Reuniones ampliadas y autocuidados:<br/>
                  <span className="font-bold block mt-1">3er y 4to Jueves de cada Mes a las 13:00 Hrs.</span>
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
