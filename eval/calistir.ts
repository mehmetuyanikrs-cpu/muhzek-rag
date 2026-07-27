/* Retrieval kalite ölçümü — her soru için pgvector aramasını çalıştırır,
   ilk sonucun (top-1) beklenen kaynak kategorisiyle eşleşip eşleşmediğini ve
   top-3 içinde beklenen kategorinin geçip geçmediğini raporlar. Alakasız
   kontrol sorusu (beklenenKaynak: null) için hiçbir parçanın eşik üstünde
   dönmemesi beklenir — yanlış pozitif kontrolü.

   Kullanım: npm run eval */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "../src/db.js";
import { bilgiGetir } from "../src/retrieve.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

type Soru = { soru: string; beklenenKaynak: string | null };

async function main() {
  const sorular = JSON.parse(readFileSync(join(__dirname, "sorular.json"), "utf8")) as Soru[];

  let top1Dogru = 0;
  let top3Dogru = 0;
  let kontrolDogru = 0;
  const degerlendirilenSoru = sorular.filter((s) => s.beklenenKaynak !== null).length;
  const kontrolSoru = sorular.length - degerlendirilenSoru;
  let benzerlikToplam = 0;
  let benzerlikSayisi = 0;

  for (const { soru, beklenenKaynak } of sorular) {
    const sonuclar = await bilgiGetir(soru, 3);

    if (beklenenKaynak === null) {
      const temiz = sonuclar.length === 0;
      if (temiz) kontrolDogru++;
      console.log(`${temiz ? "✓" : "✗"} [kontrol] "${soru}" — ${sonuclar.length} parça döndü (0 beklenirdi)`);
      continue;
    }

    const kaynaklar = sonuclar.map((s) => s.kaynak.split("/")[0]);
    const ilkDogru = kaynaklar[0] === beklenenKaynak;
    const uctenBiriDogru = kaynaklar.includes(beklenenKaynak);
    if (ilkDogru) top1Dogru++;
    if (uctenBiriDogru) top3Dogru++;
    if (sonuclar[0]) {
      benzerlikToplam += sonuclar[0].benzerlik;
      benzerlikSayisi++;
    }

    console.log(
      `${ilkDogru ? "✓" : uctenBiriDogru ? "~" : "✗"} "${soru}"\n` +
        `   beklenen: ${beklenenKaynak} | top-1: ${kaynaklar[0] ?? "(yok)"} (${sonuclar[0]?.benzerlik.toFixed(2) ?? "-"}) | top-3: [${kaynaklar.join(", ")}]`
    );
  }

  console.log("\n--- ÖZET ---");
  console.log(`Top-1 isabet: ${top1Dogru}/${degerlendirilenSoru}`);
  console.log(`Top-3 isabet: ${top3Dogru}/${degerlendirilenSoru}`);
  console.log(`Kontrol (alakasız soru → boş sonuç): ${kontrolDogru}/${kontrolSoru}`);
  if (benzerlikSayisi > 0) {
    console.log(`Doğru isabetlerde ortalama top-1 benzerlik: ${(benzerlikToplam / benzerlikSayisi).toFixed(3)}`);
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error("HATA:", e instanceof Error ? e.message : e);
  await pool.end();
  process.exit(1);
});
