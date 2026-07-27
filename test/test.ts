import assert from "node:assert/strict";
import { mdBolumle, pdfObekle } from "../src/chunk.js";

let gecen = 0;
function dogrula(ad: string, fn: () => void) {
  fn();
  gecen++;
  console.log(`  GEÇTİ: ${ad}`);
}

dogrula("md bölümleme başlıkları yakalar", () => {
  const parcalar = mdBolumle(
    "# Başlık\n\n## Bölüm Bir\nBu bölüm bir metnidir ve yeteri kadar uzun.\n\n## Bölüm İki\nBu da ikinci bölümün metnidir, yeteri kadar uzun.\n"
  );
  assert.equal(parcalar.length, 2);
  assert.equal(parcalar[0].bolum, "Bölüm Bir");
  assert.equal(parcalar[1].bolum, "Bölüm İki");
});

dogrula("md bölümleme kısa parçaları atar", () => {
  const parcalar = mdBolumle("## Kısa\nkısa\n\n## Uzun\n" + "x".repeat(50));
  assert.equal(parcalar.length, 1);
  assert.equal(parcalar[0].bolum, "Uzun");
});

dogrula("pdf öbekleme MADDE etiketini yakalar", () => {
  // Her paragraf tek başına hedefi (2000) aşacak kadar büyük olmalı ki
  // ayrı öbeklere düşsünler — kısa maddeler aynı öbekte birleşir (bilinçli).
  const metin = `MADDE 1 - (1) ${"a".repeat(2200)}\n\nMADDE 2 - (1) ${"b".repeat(2200)}\n`;
  const obekler = pdfObekle(metin);
  assert.ok(obekler.some((o) => o.bolum === "MADDE 1"));
  assert.ok(obekler.some((o) => o.bolum === "MADDE 2"));
});

dogrula("pdf öbekleme sayfa numarası satırlarını temizler", () => {
  const metin = `MADDE 5 - (1) ${"c".repeat(300)}\n\n42\n\nSayfa 12 / 100\n`;
  const obekler = pdfObekle(metin);
  const govde = obekler.map((o) => o.metin).join(" ");
  assert.ok(!govde.includes("Sayfa 12"));
});

dogrula("pdf öbekleme tavanı aşan bloğu böler", () => {
  const buyukBlok = "MADDE 9 - " + "kelime ".repeat(2000); // ~14000 karakter, tek paragraf
  const obekler = pdfObekle(buyukBlok);
  assert.ok(obekler.length > 1, "tavanı aşan tek paragraf birden fazla parçaya bölünmeli");
  for (const o of obekler) assert.ok(o.metin.length <= 8000);
});

console.log(`\n${gecen} test geçti.`);
