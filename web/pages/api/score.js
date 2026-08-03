import { submitScore } from "../../lib/store";
import { roundIndexAt } from "../../lib/rounds";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { name, address, score } = req.body || {};
    const points = Number(score);

    // The board is keyed by wallet address so one player is one row; the display
    // name is only a label. Guard both — the body arrives from the browser.
    const member = String(address || name || "").trim().slice(0, 64);
    if (!member) return res.status(400).json({ error: "Missing address" });
    if (!Number.isFinite(points) || points < 0) {
      return res.status(400).json({ error: "Invalid score" });
    }

    // The run belongs to the round it finished in — the server decides which,
    // so a client clock cannot post into a round that has already paid out.
    const round = roundIndexAt();
    await submitScore({ round, member, score: Math.floor(points) });
    return res.status(201).json({ ok: true, round });
  } catch (error) {
    console.error("[nyan.city] score:", error);
    return res.status(500).json({ error: "Could not save that run" });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
