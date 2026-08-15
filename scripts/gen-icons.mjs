// Genera los iconos de la PWA sin depender de ninguna libreria de imagen:
// se pintan los pixeles a mano y se empaquetan en PNG con el zlib de Node.
//
//   node scripts/gen-icons.mjs
//
// Diseno: cuadrado redondeado indigo con una aguja de brujula blanca.

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const BG = [79, 70, 229]; // #4f46e5
const FG = [255, 255, 255];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  // Cada fila lleva un byte de filtro (0) delante, luego RGBA.
  const raw = Buffer.alloc(size * (1 + size * 4));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/// Suaviza el borde de una forma segun su distancia con signo, en pixeles.
function cobertura(dist) {
  return Math.max(0, Math.min(1, 0.5 - dist));
}

function icono(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const px = x + 0.5;
  const py = y + 0.5;

  // Cuadrado redondeado (maskable: la forma llega hasta el borde).
  const r = size * 0.22;
  const dx = Math.max(Math.abs(px - cx) - (cx - r), 0);
  const dy = Math.max(Math.abs(py - cy) - (cy - r), 0);
  const fondo = cobertura(Math.hypot(dx, dy) - r);
  if (fondo <= 0) return [0, 0, 0, 0];

  // Anillo de la brujula.
  const d = Math.hypot(px - cx, py - cy);
  const radio = size * 0.28;
  const grosor = size * 0.045;
  const anillo = cobertura(Math.abs(d - radio) - grosor / 2);

  // Aguja: rombo estrecho girado 45 grados, apuntando arriba a la derecha.
  const ang = -Math.PI / 4;
  const ux = (px - cx) * Math.cos(ang) - (py - cy) * Math.sin(ang);
  const uy = (px - cx) * Math.sin(ang) + (py - cy) * Math.cos(ang);
  const largo = size * 0.2;
  const ancho = size * 0.055;
  const rombo = cobertura(
    (Math.abs(ux) / ancho + Math.abs(uy) / largo - 1) * Math.min(ancho, largo),
  );

  const tinta = Math.max(anillo, rombo);
  const rgb = [0, 1, 2].map((i) => Math.round(BG[i] * (1 - tinta) + FG[i] * tinta));
  return [rgb[0], rgb[1], rgb[2], Math.round(fondo * 255)];
}

for (const size of [192, 512]) {
  writeFileSync(`public/icon-${size}.png`, png(size, icono));
  console.log(`public/icon-${size}.png`);
}
