import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Pool } from "pg";
import { DATABASE_URL, EMBED_BOYUT } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const pool = new Pool({ connectionString: DATABASE_URL });

/* Şemayı idempotent şekilde kurar — ayrı bir "migrate" adımına gerek kalmadan
   `npm run ingest` veya sunucu ilk açılışta tabloyu hazırlar. */
export async function semayiHazirla(): Promise<void> {
  const sql = readFileSync(join(__dirname, "..", "migrations", "001_init.sql"), "utf8").replace(
    /vector\(768\)/g,
    `vector(${EMBED_BOYUT})`
  );
  await pool.query(sql);
}
