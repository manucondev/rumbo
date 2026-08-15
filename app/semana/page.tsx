import { formatMin, shortLabel, todayMadrid, weekdayLabel } from "@/lib/date";
import { weekSummary } from "@/lib/day";

export const dynamic = "force-dynamic";

export default async function SemanaPage() {
  const date = todayMadrid();
  const week = await weekSummary(date);

  const conObjetivo = week.projects.filter((p) => p.targetMin > 0 || p.actualMin > 0);
  const maxMin = Math.max(60, ...conObjetivo.map((p) => Math.max(p.targetMin, p.actualMin)));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          {shortLabel(week.from)} — {shortLabel(week.to)}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Semana</h1>
        <p className="mt-1 text-sm text-muted">
          {formatMin(week.totalMin)} reales · {week.doneTasks} tareas cerradas ·{" "}
          {week.closedDays} dias cerrados
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
          Objetivo contra realidad
        </h2>

        {conObjetivo.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted">
            Todavia no hay minutos registrados esta semana.
          </p>
        ) : (
          <ul className="card divide-y divide-border">
            {conObjetivo.map((p) => {
              const deficit = p.targetMin - p.actualMin;
              return (
                <li key={p.id} className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: p.color }}
                        aria-hidden
                      />
                      {p.name}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {formatMin(p.actualMin)}
                      {p.targetMin > 0 && <> / {formatMin(p.targetMin)}</>}
                    </span>
                  </div>

                  <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(p.actualMin / maxMin) * 100}%`,
                        background: p.color,
                      }}
                    />
                    {p.targetMin > 0 && (
                      <span
                        className="absolute inset-y-0 w-0.5 bg-foreground/40"
                        style={{ left: `${(p.targetMin / maxMin) * 100}%` }}
                        aria-hidden
                      />
                    )}
                  </div>

                  {p.targetMin > 0 && (
                    <p className="mt-1.5 text-xs text-muted">
                      {deficit > 15
                        ? `faltan ${formatMin(deficit)}`
                        : deficit < -15
                          ? `${formatMin(-deficit)} por encima`
                          : "en el objetivo"}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Dia a dia</h2>
        <ul className="card divide-y divide-border">
          {week.days.length === 0 && (
            <li className="p-4 text-sm text-muted">Sin dias registrados.</li>
          )}
          {week.days.map((d) => {
            const real = d.blocks.reduce((sum, b) => sum + b.actualMin, 0);
            const hechos = d.blocks.filter((b) => b.status === "DONE").length;
            return (
              <li key={d.id} className="flex items-center gap-3 p-4">
                <span className="w-20 shrink-0 text-sm capitalize">{weekdayLabel(d.date)}</span>
                <span className="flex-1 text-xs text-muted">
                  {hechos}/{d.blocks.length} bloques
                  {d.energy && <> · energia {d.energy}/5</>}
                </span>
                <span className="font-mono text-xs">{formatMin(real)}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
