"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, FolderKanban, Inbox, Sun } from "lucide-react";

const LINKS = [
  { href: "/", label: "Hoy", icon: Sun },
  { href: "/tareas", label: "Tareas", icon: Inbox },
  { href: "/proyectos", label: "Frentes", icon: FolderKanban },
  { href: "/semana", label: "Semana", icon: CalendarRange },
] as const;

export function Nav() {
  const pathname = usePathname();

  // En la pantalla de entrada no hay nada que navegar.
  if (pathname === "/entrar") return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[480px] items-stretch pb-[env(safe-area-inset-bottom)]">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
