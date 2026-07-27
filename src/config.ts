/* Ortam değişkenleri + mimari sabitler — hepsi tek yerden, gerekçesiyle. */

import { existsSync, readFileSync } from "node:fs";

/* .env dosyasını process.env'e yükler (varsa) — docker-compose zaten
   env_file ile enjekte ediyor, bu yalnız `npm run ingest`/`ask`/`eval`'i
   Docker dışında host'ta çalıştıranlar için gerekli. */
if (existsSync(".env")) {
  for (const satir of readFileSync(".env", "utf8").split("\n")) {
    const m = satir.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/muhzek_rag";
export const PORT = Number(process.env.PORT ?? 3000);

/* Parça (chunk) hedef boyutu: paragraf sınırına saygılı bölme bu karaktere
   yaklaşınca kesilir. 2000 karakter — bir "MADDE" fıkrasının bağlamını
   koparmadan tek parçaya sığdıracak kadar büyük, embedding'in konuyu
   bulanıklaştırmayacağı kadar küçük. */
export const OBEK_KARAKTER = 2000;

/* Tavan: bölünmemiş tablo/liste blokları hedefi aşabilir; yalnız bu tavanı
   aşan parça zorla bölünür. Tavanı OBEK_KARAKTER ile aynı yapmak sık sık
   orta-cümleden bölmeye yol açar — tavan yüksek tutulup normal bölme paragraf
   sınırında yapılır. */
export const PARCA_TAVANI = 8000;

/* Embedding'e gönderilen ön ek uzunluğu: konuyu yakalamaya yeter, tam parçayı
   göndermek gemini-embedding-001 için gereksiz token maliyeti demek
   (DB'ye yazılan tam metin OBEK_KARAKTER/PARCA_TAVANI'na kadar olabilir,
   vektörleme yalnız bu ön ekten yapılır). */
export const EMBED_KARAKTER = 1000;

/* gemini-embedding-001, 768 boyutlu çıktı: Google'ın ücretsiz kotada sunduğu,
   Türkçe dahil çok dilli metinlerde iyi sonuç veren güncel embedding modeli
   (eski text-embedding-004 kaldırıldı). 768 boyut pgvector hnsw indeksinde
   1536/3072'ye göre daha ucuz depolama/arama sağlıyor, bu ölçekte doğruluk
   farkı gözlenmedi. */
export const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_BOYUT = 768;

/* Cevap üretiminde kullanılan sohbet modeli — Gemini'nin OpenAI-uyumlu ucu. */
export const CHAT_MODEL = "gemini-2.5-flash";

/* Benzerlik eşiği: kosinüs benzerliği bu değerin altındaki parçalar bağlama
   hiç girmez. 0.60 — küçük bir korpusta (birkaç yönetmelik) alakasız en yakın
   komşuları elemeye yeten, gerçek isabetleri (tipik 0.70+) kesmeyen bir değer
   olarak eval/ ile doğrulandı. */
export const BENZERLIK_ESIGI = 0.6;

/* Tek sorguda getirilecek parça sayısı. */
export const TOP_K = 4;

/* Toplu embedding isteği başına parça sayısı + dakikada hedeflenen token —
   ücretsiz kota limitlerinin (~30K token/dk) altında kalmak için. */
export const BATCH = 40;
export const HEDEF_TPM = 25_000;
