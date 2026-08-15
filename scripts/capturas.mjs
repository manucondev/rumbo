// Genera las capturas del README manejando el Chrome ya instalado por su
// protocolo de depuracion (CDP). No descarga ningun navegador y no hace falta
// Playwright: Node 24 ya trae WebSocket de serie.
//
//   npm run capturas
//
// Necesita el servidor de desarrollo levantado y firma su propia cookie de
// sesion con AUTH_SECRET, asi que no hay que teclear el PIN.

import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "dotenv/config";
import { SignJWT } from "jose";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.CAPTURAS_URL ?? "http://localhost:3000";
const PUERTO = 9333;
const ANCHO = 390;
const ALTO = 844;
const TEMA = process.env.CAPTURAS_TEMA ?? "light";

const EJEMPLO =
  "quiero repasar algebra lineal un rato los fines de semana, " +
  "y terminar el curso de langchain de aqui a un mes";

// En /capturar hay que rellenar y pulsar: un cuadro de texto vacio no cuenta
// nada, y lo que merece la pena ver es la interpretacion ya hecha.
const RELLENAR_CAPTURA = `
  (async () => {
    const ta = document.querySelector("textarea");
    // React ignora un .value directo: hay que usar el setter nativo y avisar.
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, "value",
    ).set;
    setter.call(ta, ${JSON.stringify(EJEMPLO)});
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent.includes("Interpretar"))
      ?.click();
  })()
`;

const PANTALLAS = [
  { ruta: "/", archivo: "hoy.png" },
  { ruta: "/capturar", archivo: "capturar.png", guion: RELLENAR_CAPTURA, espera: 9000 },
  { ruta: "/semana", archivo: "semana.png" },
];

const perfil = join(tmpdir(), `rumbo-capturas-${Date.now()}`);
mkdirSync("docs", { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PUERTO}`,
  `--user-data-dir=${perfil}`,
  "--no-first-run",
  "--disable-extensions",
  "--hide-scrollbars",
  `--window-size=${ANCHO},${ALTO}`,
]);

async function esperarCdp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Chrome no levanto el puerto de depuracion");
}

/// Cliente CDP minimo: manda comandos numerados y resuelve por id.
function conectar(url) {
  const ws = new WebSocket(url);
  const pendientes = new Map();
  let id = 0;

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    const p = pendientes.get(msg.id);
    if (!p) return;
    pendientes.delete(msg.id);
    msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
  });

  const listo = new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });

  return {
    listo,
    cerrar: () => ws.close(),
    enviar(method, params = {}, sessionId) {
      const mensaje = { id: ++id, method, params, ...(sessionId ? { sessionId } : {}) };
      return new Promise((resolve, reject) => {
        pendientes.set(mensaje.id, { resolve, reject });
        ws.send(JSON.stringify(mensaje));
      });
    },
  };
}

try {
  const wsUrl = await esperarCdp();
  const cdp = conectar(wsUrl);
  await cdp.listo;

  const { targetInfos } = await cdp.enviar("Target.getTargets");
  const pagina = targetInfos.find((t) => t.type === "page");
  const { sessionId } = await cdp.enviar("Target.attachToTarget", {
    targetId: pagina.targetId,
    flatten: true,
  });

  const s = (m, p) => cdp.enviar(m, p, sessionId);

  await s("Page.enable");
  await s("Network.enable");

  // Sin esto la captura sale con el tema que tenga el sistema operativo.
  await s("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: TEMA }],
  });

  // El indicador de desarrollo de Next se planta encima de la barra inferior.
  await s("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      const css = document.createElement("style");
      css.textContent = "nextjs-portal, [data-nextjs-toast] { display: none !important; }";
      document.addEventListener("DOMContentLoaded", () => document.head.append(css));
    `,
  });

  // Pantalla de movil con densidad 2: las capturas salen nitidas.
  await s("Emulation.setDeviceMetricsOverride", {
    width: ANCHO,
    height: ALTO,
    deviceScaleFactor: 2,
    mobile: true,
  });

  const token = await new SignJWT({ ok: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));

  const { hostname } = new URL(BASE);
  await s("Network.setCookie", {
    name: "rumbo_sesion",
    value: token,
    domain: hostname,
    path: "/",
  });

  for (const { ruta, archivo, guion, espera } of PANTALLAS) {
    await s("Page.navigate", { url: `${BASE}${ruta}` });
    // Esperar a que la red se calme; con Server Components basta de sobra.
    await new Promise((r) => setTimeout(r, 2500));

    if (guion) {
      await s("Runtime.evaluate", { expression: guion, awaitPromise: true });
      await new Promise((r) => setTimeout(r, espera ?? 3000));
    }

    const { data } = await s("Page.captureScreenshot", { format: "png" });
    writeFileSync(`docs/${archivo}`, Buffer.from(data, "base64"));
    console.log(`docs/${archivo}`);
  }

  cdp.cerrar();
} finally {
  chrome.kill();
  try {
    rmSync(perfil, { recursive: true, force: true });
  } catch {}
}
