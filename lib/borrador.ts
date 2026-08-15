// Lo que devuelve el LLM al interpretar un texto libre, ya saneado.
//
// Vive aparte de lib/captura.ts (que es "server-only") para poder testear la
// normalizacion sin montar el entorno de servidor ni llamar a ningun modelo.
// Un LLM devuelve lo que le da la gana, asi que aqui no se confia en nada:
// todo se recorta, se acota y se descarta si no encaja.

export type Nivel = 1 | 2 | 3;

export type BorradorFrente = {
  nombre: string;
  horasSemana: number;
  prioridad: Nivel;
  /// true si no existia ya en la base de datos.
  nuevo: boolean;
};

export type BorradorTarea = {
  frente: string;
  titulo: string;
  estimateMin: number;
  importancia: Nivel;
  /// "YYYY-MM-DD" o null.
  dueDate: string | null;
};

export type Borrador = {
  frentes: BorradorFrente[];
  tareas: BorradorTarea[];
};

const MAX_FRENTES = 20;
const MAX_TAREAS = 60;
const MAX_TITULO = 120;

function texto(valor: unknown, max: number): string {
  if (typeof valor !== "string") return "";
  return valor.trim().replace(/\s+/g, " ").slice(0, max);
}

function nivel(valor: unknown, porDefecto: Nivel): Nivel {
  const n = Math.round(Number(valor));
  return n === 1 || n === 2 || n === 3 ? n : porDefecto;
}

function minutos(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return 30;
  // A multiplos de 5, entre 5 minutos y 8 horas.
  return Math.min(480, Math.max(5, Math.round(n / 5) * 5));
}

function horas(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(40, Math.round(n * 2) / 2);
}

function fecha(valor: unknown): string | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Que el calendario cuadre: descarta "2026-02-31" y compania.
  return d.toISOString().slice(0, 10) === valor ? valor : null;
}

/// Convierte lo que sea que haya devuelto el modelo en un borrador utilizable.
/// `frentesExistentes` sirve para saber cuales son nuevos y para que una tarea
/// nunca quede huerfana: si menciona un frente que nadie declaro, se crea.
export function normalizarBorrador(
  bruto: unknown,
  frentesExistentes: string[] = [],
): Borrador {
  const raiz = (bruto ?? {}) as Record<string, unknown>;
  const existentes = new Map(frentesExistentes.map((n) => [n.toLowerCase(), n]));

  const frentes: BorradorFrente[] = [];
  const vistos = new Map<string, BorradorFrente>();

  function registrar(nombreBruto: unknown, extra?: Record<string, unknown>) {
    const nombre = texto(nombreBruto, 60);
    if (!nombre) return null;

    const clave = nombre.toLowerCase();
    const yaVisto = vistos.get(clave);
    if (yaVisto) return yaVisto;

    // Si ya existe en la base de datos, se respeta su nombre tal cual esta
    // escrito alli para no acabar con "byCualia" y "Bycualia" a la vez.
    const canonico = existentes.get(clave) ?? nombre;
    const frente: BorradorFrente = {
      nombre: canonico,
      horasSemana: horas(extra?.horasSemana),
      prioridad: nivel(extra?.prioridad, 2),
      nuevo: !existentes.has(clave),
    };
    vistos.set(clave, frente);
    frentes.push(frente);
    return frente;
  }

  if (Array.isArray(raiz.frentes)) {
    for (const f of raiz.frentes.slice(0, MAX_FRENTES)) {
      if (f && typeof f === "object") {
        const obj = f as Record<string, unknown>;
        registrar(obj.nombre, obj);
      }
    }
  }

  const tareas: BorradorTarea[] = [];
  if (Array.isArray(raiz.tareas)) {
    for (const t of raiz.tareas.slice(0, MAX_TAREAS)) {
      if (!t || typeof t !== "object") continue;
      const obj = t as Record<string, unknown>;

      const titulo = texto(obj.titulo, MAX_TITULO);
      if (!titulo) continue;

      // Una tarea sin frente reconocible no se descarta: se le crea el suyo.
      const frente = registrar(obj.frente) ?? registrar("Sin clasificar");
      if (!frente) continue;

      tareas.push({
        frente: frente.nombre,
        titulo,
        estimateMin: minutos(obj.estimateMin),
        importancia: nivel(obj.importancia, 2),
        dueDate: fecha(obj.dueDate),
      });
    }
  }

  return { frentes, tareas };
}
