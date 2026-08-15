import Link from "next/link";

import { Capturador } from "@/components/capturador";
import { proveedorIA } from "@/lib/captura";

export const dynamic = "force-dynamic";

export default function CapturarPage() {
  const proveedor = proveedorIA();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Soltarlo todo</h1>
        <p className="mt-1 text-sm text-muted">
          Escribe en cristiano lo que llevas entre manos y se convierte en frentes y tareas.
          Antes de crear nada te enseno lo que ha entendido.
        </p>
      </header>

      {proveedor ? (
        <Capturador />
      ) : (
        <div className="card space-y-2 p-6 text-center">
          <p className="text-sm">Falta la clave de IA.</p>
          <p className="text-xs text-muted">
            Anade <code className="font-mono">GEMINI_API_KEY</code> (gratis) o{" "}
            <code className="font-mono">OPENAI_API_KEY</code> al entorno y vuelve a
            desplegar. Hasta entonces, las tareas se meten a mano.
          </p>
          <Link href="/tareas" className="btn-ghost mt-2">
            Ir a tareas
          </Link>
        </div>
      )}
    </div>
  );
}
