/* Retrieval + LLM: bulunan parçaları bağlama koyar, Gemini'nin OpenAI-uyumlu
   sohbet ucuna gönderir. Model yalnızca verilen bağlamdan yanıtlamalı,
   madde/kaynak uydurmamalı. */

import { CHAT_MODEL, GEMINI_API_KEY } from "./config.js";
import { bilgiGetir, baglamMetniOlustur, type BilgiParcasi } from "./retrieve.js";

const CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const SISTEM_TALIMATI = `Sen kamuya açık Türkçe mühendislik yönetmelikleri üzerinde
çalışan bir RAG asistanısın. Yalnızca sana verilen BİLGİ TABANI bağlamındaki
bilgiyi kullanarak yanıt ver.

Kurallar:
- Bağlamda yanıt yoksa "Bu bilgi bilgi tabanında bulunamadı." de — madde
  numarası veya hüküm UYDURMA.
- Kullandığın her bilgi için kaynağı "[kaynak adı — bölüm]" biçiminde belirt.
- Türkçe, kısa ve öz yanıt ver.
- Bu bir demo/referans uygulamasıdır; gerçek bir işlemde kullanmadan önce
  ilgili yönetmeliğin güncel halinin mevzuat.gov.tr'den doğrulanması gerektiğini
  hatırlat.`;

export type YanitSonucu = {
  yanit: string;
  kaynaklar: BilgiParcasi[];
};

export async function soruSor(soru: string): Promise<YanitSonucu> {
  const kaynaklar = await bilgiGetir(soru);
  const baglam = baglamMetniOlustur(kaynaklar);

  if (!GEMINI_API_KEY) {
    return {
      yanit: "GEMINI_API_KEY tanımlı değil — .env dosyanı kontrol et.",
      kaynaklar,
    };
  }

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.2,
      max_tokens: 1500,
      messages: [
        { role: "system", content: SISTEM_TALIMATI },
        {
          role: "user",
          content: baglam ? `${baglam}\n\nSORU: ${soru}` : `(Bilgi tabanında ilgili parça bulunamadı)\n\nSORU: ${soru}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Sohbet isteği başarısız: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  }
  const veri = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const yanit = veri.choices?.[0]?.message?.content ?? "(boş yanıt)";
  return { yanit, kaynaklar };
}
