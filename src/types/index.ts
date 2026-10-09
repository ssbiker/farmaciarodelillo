import { Timestamp } from "firebase/firestore";

export type Sector = "A" | "B" | "CECOSF";
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
  // Nuevas funcionalidades
  autoRenovacion?: number;    // 0 = sin renovación, 1-6 = meses
  mesesDescontados?: number;  // Cuántos meses ya se han descontado del inventario
  motivoRechazo?: string;     // motivo cuando estado = rechazado
  creadoPorMedico?: boolean;  // true si la creó el médico mismo
  // Stock y conexión con inventario
  codigoMedicamento?: string; // Código del medicamento desde el Excel
  cantidad?: number;          // Cantidad a despachar (unidades)
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
  /** Roles: 'admin' | 'quimico' | 'medico' | 'funcionario' | 'tens' | 'tecnico' */
  role?: string;
  inFarmaciaTeam?: boolean;
  /** Flag independiente: permite a cualquier rol (ej: admin) autorizar/rechazar recetas */
  isMedico?: boolean;
  /** Flag independiente: permite a cualquier rol (ej: admin) crear e ingresar recetas */
  isFuncionario?: boolean;
}

export interface MedicamentoInventario {
  codigo: string;
  nombre: string;
  stock: number;
  actualizadoEn: Timestamp;
}
