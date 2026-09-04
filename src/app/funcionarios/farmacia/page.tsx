"use client";

import React from "react";
import Link from "next/link";
import { Pill, AlertCircle, ChevronLeft, Construction, Activity } from "lucide-react";

export default function FarmaciaPage() {
  return (
    <div className="min-h-screen bg-[#0F0F1E] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      
      {/* Background decorations */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-brand-purple/20 blur-[120px] rounded-full pointer-events-none opacity-50" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Back button */}
      <div className="absolute top-6 left-6 z-10">
        <Link href="/funcionarios" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10 text-sm font-medium">
          <ChevronLeft className="w-4 h-4" /> Volver al Inicio
        </Link>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto w-full space-y-8 animate-fade-in-up">
        
        {/* Icon Header */}
        <div className="relative w-24 h-24 mx-auto">
          <div className="absolute inset-0 bg-brand-purple/20 blur-2xl rounded-full animate-pulse" />
          <div className="relative bg-gradient-to-br from-[#7B2FBE] to-[#5C1FA0] w-full h-full rounded-3xl flex items-center justify-center shadow-2xl border border-white/20 transform rotate-12 hover:rotate-0 transition-transform duration-500 cursor-pointer">
            <Pill className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black tracking-widest uppercase mb-2">
            <Construction className="w-3.5 h-3.5" /> En Desarrollo
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
            Módulo <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-blue-400">Farmacia</span>
          </h1>
          <p className="text-lg text-white/60 max-w-lg mx-auto leading-relaxed">
            Estamos construyendo el nuevo sistema de gestión de recetas médicas para brindar una experiencia más rápida y segura.
          </p>
        </div>

        {/* Progress Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl mt-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-purple animate-pulse" />
              <span className="font-bold text-white">Progreso de Implementación</span>
            </div>
            <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-white">
              3%
            </span>
          </div>

          <div className="relative h-4 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#7B2FBE] to-[#9D4EDD] w-[3%] rounded-full shadow-[0_0_15px_rgba(123,47,190,0.8)]"
            />
            {/* Shimmer effect */}
            <div className="absolute top-0 left-0 h-full w-[3%] bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>

          <div className="mt-6 flex items-start gap-3 bg-brand-purple/10 border border-brand-purple/20 p-4 rounded-xl text-left">
            <AlertCircle className="w-5 h-5 text-brand-purple shrink-0 mt-0.5" />
            <p className="text-sm text-brand-purple/80">
              Actualmente nos encontramos en la fase inicial del desarrollo. Pronto podrás gestionar recetas crónicas, controladas y recibir alertas automáticas.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
