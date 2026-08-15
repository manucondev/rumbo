"use client";

import { useState, useTransition } from "react";
import { Compass } from "lucide-react";

import { entrar } from "./actions";

export default function EntrarPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await entrar(pin);
      if (res?.error) {
        setError(res.error);
        setPin("");
      }
    });
  }

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Compass size={36} className="text-accent" />
        <h1 className="text-2xl font-semibold tracking-tight">Rumbo</h1>
        <p className="text-sm text-muted">Que toca hoy, decidido antes de levantarte.</p>
      </div>

      <div className="w-full max-w-64 space-y-3">
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="field text-center tracking-[0.4em]"
        />

        <button
          type="button"
          onClick={submit}
          disabled={pending || !pin}
          className="btn-primary w-full"
        >
          {pending ? "Comprobando..." : "Entrar"}
        </button>

        {error && <p className="text-center text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
