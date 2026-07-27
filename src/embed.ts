/* Gemini embedding istemcisi — tekil ve toplu (batch) vektörleme.
   Toplu uç, 429 (kota) ve 5xx hatalarına karşı bekleyip yeniden dener;
   büyük bir belge kümesini ilk seferde tam vektörlemek için gerekli. */

import { EMBED_MODEL, EMBED_BOYUT, GEMINI_API_KEY } from "./config.js";

const TEKIL_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
const BATCH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents`;

export async function vektorle(metin: string): Promise<number[] | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await fetch(`${TEKIL_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text: metin.slice(0, 8000) }] },
        outputDimensionality: EMBED_BOYUT,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const veri = (await res.json()) as { embedding?: { values?: number[] } };
    const v = veri.embedding?.values;
    return Array.isArray(v) && v.length === EMBED_BOYUT ? v : null;
  } catch {
    return null;
  }
}

export async function batchVektorle(metinler: string[]): Promise<number[][]> {
  const govde = {
    requests: metinler.map((t) => ({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text: t.slice(0, 8000) }] },
      outputDimensionality: EMBED_BOYUT,
    })),
  };
  for (let deneme = 0; deneme < 6; deneme++) {
    let res: Response;
    try {
      res = await fetch(`${BATCH_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
      });
    } catch (e) {
      const bekle = 15 * (deneme + 1);
      console.log(`   ağ hatası (${e instanceof Error ? e.message : e}) — ${bekle} sn...`);
      await new Promise((r) => setTimeout(r, bekle * 1000));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const bekle = 30 * (deneme + 1);
      console.log(`   kota/sunucu (${res.status}) — ${bekle} sn bekleniyor...`);
      await new Promise((r) => setTimeout(r, bekle * 1000));
      continue;
    }
    if (!res.ok) {
      throw new Error(`Batch embedding HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const veri = (await res.json()) as { embeddings?: { values?: number[] }[] };
    const vek = veri.embeddings?.map((e) => e.values ?? []);
    if (!vek || vek.length !== metinler.length || vek.some((v) => v.length !== EMBED_BOYUT)) {
      throw new Error("Batch embedding boyutu beklenmedik");
    }
    return vek;
  }
  throw new Error("Batch embedding: tekrar tekrar başarısız (kota/ağ)");
}
