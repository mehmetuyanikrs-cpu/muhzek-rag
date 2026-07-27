/* Kullanım: npm run ask -- "İmar planında yapı yaklaşma mesafesi nedir?" */

import { pool } from "./db.js";
import { soruSor } from "./ask.js";

async function main() {
  const soru = process.argv.slice(2).join(" ").trim();
  if (!soru) {
    console.error('Kullanım: npm run ask -- "sorunuz"');
    process.exit(1);
  }

  console.log(`Soru: ${soru}\n`);
  const { yanit, kaynaklar } = await soruSor(soru);
  console.log(yanit);

  if (kaynaklar.length > 0) {
    console.log("\n--- Kullanılan parçalar (retrieval) ---");
    for (const k of kaynaklar) {
      console.log(`  [${k.benzerlik.toFixed(2)}] ${k.kaynak} — ${k.bolum}`);
    }
  } else {
    console.log("\n(Eşik üstünde ilgili parça bulunamadı.)");
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error("HATA:", e instanceof Error ? e.message : e);
  await pool.end();
  process.exit(1);
});
