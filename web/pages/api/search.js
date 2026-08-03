import { topScores } from "../../lib/store";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const count = Math.min(Math.max(Number(req.query.count) || 3, 1), 25);
    const scores = await topScores(count);
    return res.status(200).json({ scores });
  } catch (error) {
    console.error("[nyan.city] search:", error);
    return res.status(500).json({ error: "Could not read the board" });
  }
}
