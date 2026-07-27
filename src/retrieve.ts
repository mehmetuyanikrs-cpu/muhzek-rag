/* Sorguyu vektörle, pgvector'de kosinüs benzerliğine göre en yakın parçaları
   bul, benzerlik eşiğinin altındakileri ele. */

import { pool } from "./db.js";
import { vektorle } from "./embed.js";
import { BENZERLIK_ESIGI, TOP_K } from "./config.js";

export type BilgiParcasi = {
  kaynak: string;
  bolum: string;
  icerik: string;
  benzerlik: number;
};

export async function bilgiGetir(soru: string, adet = TOP_K): Promise<BilgiParcasi[]> {
  const vektor = await vektorle(soru);
  if (!vektor) return [];
  const sorguVektor = `[${vektor.join(",")}]`;
  const { rows } = await pool.query<BilgiParcasi>(
    `select kaynak, bolum, icerik, 1 - (embedding <=> $1) as benzerlik
       from chunks
      order by embedding <=> $1
      limit $2`,
    [sorguVektor, Math.max(1, Math.min(adet, 10))]
  );
  return rows.filter((p) => p.benzerlik >= BENZERLIK_ESIGI);
}

/* Bulunan parçaları LLM'e verilecek bağlam bloğuna çevirir. */
export function baglamMetniOlustur(parcalar: BilgiParcasi[]): string {
  if (parcalar.length === 0) return "";
  const govde = parcalar
    .map((p, i) => `[${i + 1}] Kaynak: ${p.kaynak}${p.bolum ? ` — ${p.bolum}` : ""}\n${p.icerik}`)
    .join("\n\n");
  return `BİLGİ TABANI (aşağıdaki parçalar soruyla ilgili olabilir; kullandığında
kaynağını "[kaynak adı — bölüm]" biçiminde belirt, ilgisizse yok say):\n\n${govde}`;
}
