// Leaderboard storage.
//
// Upstash is optional. When UPSTASH_REDIS_REST_URL / _TOKEN are absent — a fresh
// clone, a preview build, someone just trying the game — the API routes fall back
// to an in-process sorted set instead of throwing at import time and 500-ing every
// request. The fallback is per-server-instance and disappears on restart, which is
// the honest behaviour for "no database configured".

import { Redis } from "@upstash/redis";

const KEY = "scores";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasRedis = Boolean(url && token);

const redis = hasRedis ? new Redis({ url, token }) : null;

// member -> best score. Module scope survives between requests in one server
// process; it deliberately does not survive a restart or a second lambda.
const memory = new Map();

/** Record a run. Only an improvement on that address's best is kept. */
export async function submitScore({ member, score }) {
  if (!member || !Number.isFinite(score)) {
    throw new Error("submitScore needs a member and a numeric score");
  }

  if (hasRedis) {
    // GT: only overwrite when the new score is greater, so a bad run cannot
    // erase somebody's best.
    await redis.zadd(KEY, { gt: true }, { score, member });
    return;
  }

  const best = memory.get(member);
  if (best === undefined || score > best) memory.set(member, score);
}

/**
 * Top `count` entries, highest first, as [{ member, score }].
 * Upstash returns `withScores` as a flat [member, score, member, score, …]
 * array, which is why callers get objects instead of raw indices.
 */
export async function topScores(count = 3) {
  if (hasRedis) {
    const flat = await redis.zrange(KEY, 0, count - 1, {
      withScores: true,
      rev: true,
    });
    return pairsToEntries(flat);
  }

  return [...memory.entries()]
    .map(([member, score]) => ({ member, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

function pairsToEntries(flat) {
  const out = [];
  if (!Array.isArray(flat)) return out;
  for (let i = 0; i < flat.length; i += 2) {
    const member = flat[i];
    const score = Number(flat[i + 1]);
    if (member === undefined) continue;
    out.push({ member: String(member), score: Number.isFinite(score) ? score : 0 });
  }
  return out;
}
