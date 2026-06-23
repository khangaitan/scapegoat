import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const OLLAMA_URL = "http://localhost:11434/api/chat";
const OLLAMA_MODEL = "phi4-mini";

interface StoryPlayer { name: string; cards: { label: string; value: string }[]; }
interface StoryRequestBody {
  survivors: StoryPlayer[];
  eliminated: StoryPlayer[];
  disaster?: { name?: string; description?: string } | null;
  bunker?: { description?: string } | null;
}

router.post("/story", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as StoryRequestBody;
    if (!body || !Array.isArray(body.survivors)) { res.status(400).json({ error: "Invalid body" }); return; }

    const fmtPlayer = (p: StoryPlayer) =>
      `- ${p.name}: ${p.cards.map(c => `${c.label} – ${c.value}`).join("; ") || "(карт нээгээгүй)"}`;

    const prompt = `Чи бол монгол зохиолч. Доорх "Сонголт" тоглоомын тоглогчдын нээсэн картууд дээр үндэслэн, ${body.disaster?.name ?? "гамшиг"}-аас амьд үлдсэн тоглогчид бункерт хэрхэн орж ирсэн тухай ЗӨВХӨН НЭГ ПАРАГРАФ, 4-6 өгүүлбэртэй богино түүх бич. Хасагдсан тоглогч байвал 1 өгүүлбэрт дурд. Зөвхөн монгол кирилл үсгээр, аятайхан, бага зэрэг хошин шогтой өгүүл. Мөр шилжүүлэлгүй, нэг л урсгал параграф.\n\nГАМШИГ: ${body.disaster?.name ?? "—"} — ${body.disaster?.description ?? ""}\nБУНКЕР: ${body.bunker?.description ?? "—"}\n\nАМЬД ҮЛДСЭН ТОГЛОГЧИД:\n${body.survivors.map(fmtPlayer).join("\n")}\n\nХАСАГДСАН ТОГЛОГЧИД:\n${body.eliminated.map(fmtPlayer).join("\n") || "(байхгүй)"}\n\nЗөвхөн өгүүллэгийн текстийг буцаа, толгой гарчиг болон мөр шилжүүлэлт хэрэггүй.`;

    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, "ollama story request failed");
      res.status(500).json({ error: "Өгүүллэг үүсгэж чадсангүй" });
      return;
    }

    const data = await response.json() as any;
    const story = data.message?.content?.trim() || "";
    res.json({ story });
  } catch (e: any) {
    logger.error({ err: e }, "story generation failed");
    res.status(503).json({ error: "Ollama холболт амжилтгүй боллоо" });
  }
});

export default router;
