/* Belge parçalama (chunking): Markdown "## Başlık" bölümleri veya yönetmelik
   PDF metni paragraf sınırına saygılı ~2000 karakterlik öbeklere ayrılır.
   Yönetmelik/tüzük metinlerinde her öbeğin ilk "MADDE n" ifadesi bölüm
   etiketi olarak yakalanır — kaynağı kullanıcıya "MADDE 12" gibi somut bir
   referansla gösterebilmek için. */

import { OBEK_KARAKTER, PARCA_TAVANI } from "./config.js";

export type Parca = { bolum: string; metin: string };

export function mdBolumle(icerik: string): Parca[] {
  const parcalar: Parca[] = [];
  let bolum = "";
  let satirlar: string[] = [];
  const kaydet = () => {
    const metin = satirlar.join("\n").trim();
    if (metin.length > 40) parcalar.push({ bolum, metin });
    satirlar = [];
  };
  for (const satir of icerik.split("\n")) {
    const h = satir.match(/^##\s+(.+)/);
    if (h) {
      kaydet();
      bolum = h[1].trim();
    } else if (!satir.startsWith("# ")) {
      satirlar.push(satir);
    }
  }
  kaydet();
  return parcalar;
}

/* Yalnız PARCA_TAVANI'nı aşan öbek bölünür (OBEK_KARAKTER değil) — aksi halde
   hedefe yakın ama biraz büyük öbekler gereksiz yere ikiye ayrılır ve
   kaynak/bölüm/içerik anahtarı değişip aynı metin kopya yüklenebilir. */
function paragrafBol(p: string): string[] {
  if (p.length <= PARCA_TAVANI) return [p];
  const sonuc: string[] = [];
  let kalan = p;
  while (kalan.length > OBEK_KARAKTER) {
    let kes = kalan.lastIndexOf("\n", OBEK_KARAKTER);
    if (kes < OBEK_KARAKTER / 2) kes = kalan.lastIndexOf(" ", OBEK_KARAKTER);
    if (kes < OBEK_KARAKTER / 2) kes = OBEK_KARAKTER;
    sonuc.push(kalan.slice(0, kes).trim());
    kalan = kalan.slice(kes).trim();
  }
  if (kalan) sonuc.push(kalan);
  return sonuc.filter((s) => s.length > 0);
}

/* PDF metnini temizleyip paragraf sınırına saygılı ~OBEK_KARAKTER'lik
   öbeklere böler; her öbekteki ilk "MADDE n" ifadesi bölüm etiketi olur. */
export function pdfObekle(metin: string): Parca[] {
  const temiz = metin
    .replace(/\r/g, "")
    .replace(/\f/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^\s*\d{1,4}\s*$/gm, "") // yalnız sayfa numarası olan satırlar
    .replace(/^\s*Sayfa\s*\d+.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n");
  const paragraflar = temiz.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
  const obekler: Parca[] = [];
  let tampon = "";
  const madde = (t: string) => {
    const m = t.match(/\bMADDE\s+(\d+)/i);
    return m ? `MADDE ${m[1]}` : `Bölüm ${obekler.length + 1}`;
  };
  const yaz = (t: string) => {
    for (const parca of paragrafBol(t.trim())) {
      obekler.push({ bolum: madde(t), metin: parca });
    }
  };
  for (const p of paragraflar) {
    if (tampon.length + p.length > OBEK_KARAKTER && tampon.length > 400) {
      yaz(tampon);
      tampon = "";
    }
    tampon += p + "\n\n";
  }
  if (tampon.trim().length > 120) yaz(tampon);
  return obekler;
}
