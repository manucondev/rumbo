"use server";

import { revalidatePath } from "next/cache";

import type { Borrador } from "@/lib/borrador";
import { aplicar, interpretar } from "@/lib/captura";

export async function interpretarTexto(
  texto: string,
): Promise<{ borrador: Borrador } | { error: string }> {
  try {
    const borrador = await interpretar(texto);
    if (borrador.tareas.length === 0 && borrador.frentes.length === 0) {
      return { error: "No he sacado nada en claro de ese texto." };
    }
    return { borrador };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Fallo al interpretar el texto" };
  }
}

export async function aplicarBorrador(borrador: Borrador) {
  const resultado = await aplicar(borrador);
  revalidatePath("/");
  revalidatePath("/tareas");
  revalidatePath("/proyectos");
  revalidatePath("/semana");
  return resultado;
}
