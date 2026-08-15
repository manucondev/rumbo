import "server-only";

// Capa fina sobre el LLM. Soporta Gemini (gratis) y OpenAI; se elige por la key
// que haya en el entorno. Si no hay ninguna, la captura por texto se desactiva
// sola y el resto de la app sigue igual.

export type ProveedorIA = "gemini" | "openai";

export function proveedorIA(): ProveedorIA | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

const MODELO_GEMINI = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const MODELO_OPENAI = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

/// Pide JSON al modelo y devuelve el texto crudo de la respuesta.
/// Lanza si el proveedor falla; quien llama decide como contarlo.
export async function pedirJson(
  instrucciones: string,
  entrada: string,
): Promise<string> {
  const proveedor = proveedorIA();
  if (!proveedor) throw new Error("No hay ninguna API key de IA configurada");

  return proveedor === "gemini"
    ? pedirJsonGemini(instrucciones, entrada)
    : pedirJsonOpenAI(instrucciones, entrada);
}

async function pedirJsonGemini(instrucciones: string, entrada: string) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI}:generateContent` +
    `?key=${process.env.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instrucciones }] },
      contents: [{ role: "user", parts: [{ text: entrada }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        // Clasificar texto no necesita cadena de razonamiento, y con ella la
        // respuesta tarda mas de 10 s: demasiado para la web y para el webhook.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini respondio ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof texto !== "string") {
    throw new Error(`Gemini devolvio algo inesperado: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return texto;
}

async function pedirJsonOpenAI(instrucciones: string, entrada: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODELO_OPENAI,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: instrucciones },
        { role: "user", content: entrada },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI respondio ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const texto = data?.choices?.[0]?.message?.content;
  if (typeof texto !== "string") {
    throw new Error(`OpenAI devolvio algo inesperado: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return texto;
}
