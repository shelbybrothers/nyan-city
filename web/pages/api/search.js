import { getWinners, settleRound, storageKind, topScores } from "../../lib/store";
import { poolForRound, prizeSplit } from "../../lib/prizes";
import { ROUND_MS, roundEnd, roundIndexAt, secondsLeft } from "../../lib/rounds";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const count = Math.min(Math.max(Number(req.query.count) || 3, 1), 50);
    const now = Date.now();
    const index = roundIndexAt(now);

    const total = poolForRound(index);
    const splits = prizeSplit(total);

    // Settle the round that just closed, if nobody has yet. Serverless has no
    // cron, so the first request after the boundary does it — and settleRound
    // freezes the result so a late score cannot rewrite a finished round.
    const previous = index - 1;
    const prevTotal = poolForRound(previous);
    let prevWinners = await getWinners(previous);
    if (!prevWinners) {
      prevWinners = await settleRound(previous, prizeSplit(prevTotal));
    }

    const scores = await topScores(index, count);

    // The countdown is the whole point of this endpoint — never let it be cached.
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json({
      round: {
        index,
        endsAt: roundEnd(index),
        secondsLeft: secondsLeft(index, now),
        lengthMs: ROUND_MS,
        now,
      },
      scores,
      pool: { total, currency: "ETH", simulated: true, splits },
      lastRound: {
        index: previous,
        total: prevTotal,
        winners: prevWinners || [],
      },
      storage: storageKind,
    });
  } catch (error) {
    console.error("[nyan.city] search:", error);
    return res.status(500).json({ error: "Could not read the board" });
  }
}
