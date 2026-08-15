// Estados como uniones de strings: SQLite no soporta `enum` en Prisma, asi que
// la validacion vive aqui en TypeScript.

export const TASK_STATUS = ["PENDING", "DOING", "DONE", "DROPPED"] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];

export const BLOCK_STATUS = ["PLANNED", "DONE", "PARTIAL", "SKIPPED"] as const;
export type BlockStatus = (typeof BLOCK_STATUS)[number];

/// 1 alta - 2 media - 3 baja
export type Level = 1 | 2 | 3;

export const IMPORTANCE_LABEL: Record<number, string> = {
  1: "Alta",
  2: "Media",
  3: "Baja",
};

export const ENERGY_LABEL: Record<number, string> = {
  1: "En el suelo",
  2: "Flojo",
  3: "Normal",
  4: "Bien",
  5: "A tope",
};

/// Paleta para los chips de proyecto.
export const PROJECT_COLORS = [
  "#6366f1", // indigo
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#a855f7", // purple
  "#ec4899", // pink
  "#64748b", // slate
] as const;
