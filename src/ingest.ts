/* Belge yükleyici — kullanım:
     npm run ingest              (docs/ altını özyineli tarar)
     npm run ingest -- <dosya>   (tek dosya)

   .pdf dosyaları paragraf sınırına saygılı ~2000 karakterlik öbeklere
   (MADDE etiketli), .md dosyaları "## Başlık" bölümlerine ayrılır. Her parça
   Gemini embedding'iyle (768 boyut, toplu istek) vektörlenip chunks tablosuna
   yazılır.

   Dayanıklılık: aynı (kaynak, bölüm, içerik) tekrar yazılmaz/vektörlenmez —
   script yarıda kesilirse yeniden çalıştırınca kaldığı yerden devam eder. */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import { createRequire } from "node:module";
import { pool, semayiHazirla } from "./db.js";
import { mdBolumle, pdfObekle, type Parca } from "./chunk.js";
import { batchVektorle } from "./embed.js";
import { BATCH, HEDEF_TPM, EMBED_KARAKTER } from "./config.js";

const require = createRequire(import.meta.url);
/* pdf-parse'ın ana index'i import anında kendi test dosyasını açmaya çalışır
   (bilinen paket hatası); doğrudan lib yolundan alınır. */
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (b: Buffer) => Promise<{ text: string }>;

const atlanan: string[] = [];

function* dosyalariBul(hedef: string): Generator<string> {
  const st = statSync(hedef);
  if (st.isDirectory()) {
    for (const ad of readdirSync(hedef).sort()) yield* dosyalariBul(join(hedef, ad));
  } else {
    yield hedef;
  }
}

/* Kaynak adı: docs/<kategori>/<dosya> → "kategori/dosya" */
function kaynakAdi(dosya: string): string {
  const uz = extname(dosya);
  const rel = relative("docs", dosya).split(sep);
  if (rel.length >= 2) return `${rel[0]}/${basename(dosya, uz)}`;
  return basename(dosya, uz);
}

async function main() {
  await semayiHazirla();

  const hedef = process.argv[2] ?? "docs";
  const dosyalar = new Set<string>();
  for (const d of dosyalariBul(hedef)) {
    const uz = extname(d).toLowerCase();
    if (uz === ".md" || uz === ".pdf") dosyalar.add(d);
    else if (uz === ".doc" || uz === ".docx") atlanan.push(`${d}  (Word — PDF'e çevrilmeli)`);
  }

  const gorulenIcerik = new Set<string>();
  let eklenen = 0;

  for (const dosya of [...dosyalar].sort()) {
    const uz = extname(dosya).toLowerCase();
    const kaynak = kaynakAdi(dosya);
    let parcalar: Parca[];
    try {
      if (uz === ".pdf") {
        const { text } = await pdfParse(readFileSync(dosya));
        if (text.replace(/\s+/g, " ").trim().length < 500) {
          atlanan.push(`${dosya}  (taranmış/metinsiz — OCR gerekir)`);
          continue;
        }
        parcalar = pdfObekle(text);
      } else {
        parcalar = mdBolumle(readFileSync(dosya, "utf8"));
      }
    } catch (e) {
      atlanan.push(`${dosya}  (okunamadı: ${e instanceof Error ? e.message : e})`);
      continue;
    }

    const { rows: mevcutRows } = await pool.query<{ bolum: string; icerik: string }>(
      "select bolum, icerik from chunks where kaynak = $1",
      [kaynak]
    );
    const mevcut = new Set(mevcutRows.map((r) => `${r.bolum} ${r.icerik}`));

    const yeni = parcalar.filter((p) => {
      const anahtar = `${p.bolum} ${p.metin}`;
      if (mevcut.has(anahtar)) return false;
      const iz = p.metin.slice(0, 200).toLowerCase();
      if (gorulenIcerik.has(iz)) return false;
      gorulenIcerik.add(iz);
      return true;
    });

    console.log(`${kaynak}: ${parcalar.length} parça (${yeni.length} yeni)`);

    for (let i = 0; i < yeni.length; i += BATCH) {
      const dilim = yeni.slice(i, i + BATCH);
      const girdiler = dilim.map((p) => `${p.bolum}\n${p.metin.slice(0, EMBED_KARAKTER)}`);
      const vekler = await batchVektorle(girdiler);

      for (let j = 0; j < dilim.length; j++) {
        const p = dilim[j];
        const vektor = `[${vekler[j].join(",")}]`;
        await pool.query(
          `insert into chunks (kaynak, bolum, icerik, embedding)
           values ($1, $2, $3, $4)
           on conflict (kaynak, bolum, icerik_hash) do nothing`,
          [kaynak, p.bolum, p.metin, vektor]
        );
      }

      eklenen += dilim.length;
      process.stdout.write(`   +${Math.min(i + BATCH, yeni.length)}/${yeni.length}\r`);
      const token = girdiler.reduce((s, t) => s + t.length, 0) / 3;
      await new Promise((r) => setTimeout(r, Math.max(400, (token / HEDEF_TPM) * 60_000)));
    }
    if (yeni.length) console.log(`   ✓ ${yeni.length} parça yüklendi`);
  }

  console.log(`\nTAMAM — ${eklenen} yeni parça işlendi.`);
  if (atlanan.length) {
    console.log(`\nATLANAN ${atlanan.length} dosya:`);
    for (const a of atlanan) console.log(`  - ${a}`);
  }
  await pool.end();
}

main().catch(async (e) => {
  console.error("HATA:", e instanceof Error ? e.message : e);
  await pool.end();
  process.exit(1);
});
