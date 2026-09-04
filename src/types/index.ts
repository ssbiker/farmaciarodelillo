import { Timestamp } from "firebase/firestore";

export type Sector = "A" | "B";
export type TipoReceta = "controlado" | "cronico";
export type EstadoReceta = "pendiente" | "completado" | "rechazado";

export type AccionAuditoria =
  | "CREACION"
  | "MODIFICACION"
  | "ENVIADA_PAPELERA"
  | "RESTAURACION"
  | "ELIMINACION_DEFINITIVA";

export interface CambioAuditoria {
  campo: string;
  antes: string | null;
  despues: string | null;
}

export interface AuditoriaEntry {
  id: string;
  accion: AccionAuditoria;
  usuarioId: string;
  usuarioEmail: string;
  usuarioNombre: string;
  fecha: Timestamp;
  cambios?: CambioAuditoria[];
}

export interface Receta {
  id: string;
  sector: Sector;
  tipo: TipoReceta;
  estado: EstadoReceta;
  nombrePaciente: string;
  rut: string;
  fechaSolicitud: Timestamp;
  fechaLimite?: Timestamp | null;   // Fecha máxima para que sea atendida
  medicamento: string;
  nota: string;
  medicoReceta?: string;
  medicoUid?: string;
  fechaReceta?: Timestamp | null;
  creadoPor: string;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
  // Soft-delete
  eliminada?: boolean;
  eliminadaPor?: string;
  eliminadaEn?: Timestamp;
  motivoEliminacion?: string;
}

export interface FarmaciaConfig {
  diasAlertaRoja: number;
  diasAlertaAmarilla: number;
  // medicos ya no está aquí — vienen de la colección users con role:"medico"
}

export interface FarmaciaUser {
  id: string;           // uid Firebase
  name: string;
  email: string;
  role?: string;
  inFarmaciaTeam?: boolean;
}
