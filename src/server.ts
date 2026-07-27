import express from "express";
import { PORT } from "./config.js";
import { semayiHazirla } from "./db.js";
import { soruSor } from "./ask.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/ask", async (req, res) => {
  const soru = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  if (!soru) {
    res.status(400).json({ hata: "'question' alanı gerekli." });
    return;
  }
  try {
    const { yanit, kaynaklar } = await soruSor(soru);
    res.json({
      answer: yanit,
      sources: kaynaklar.map((k) => ({
        source: k.kaynak,
        section: k.bolum,
        similarity: Number(k.benzerlik.toFixed(3)),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(502).json({ hata: e instanceof Error ? e.message : "Beklenmeyen hata" });
  }
});

semayiHazirla()
  .then(() => {
    app.listen(PORT, () => console.log(`muhzek-rag API http://localhost:${PORT} adresinde çalışıyor`));
  })
  .catch((e) => {
    console.error("Şema hazırlama hatası:", e);
    process.exit(1);
  });
