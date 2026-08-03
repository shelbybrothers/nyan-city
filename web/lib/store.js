// Leaderboard storage.
//
// Upstash is optional. When UPSTASH_REDIS_REST_URL / _TOKEN are absent — a fresh
// clone, a preview build, someone just trying the game — the API routes fall back
// to an in-process sorted set instead of throwing at import time and 500-ing every
// request. The fallback is per-server-instance and disappears on restart, which is
// the honest behaviour for "no database configured".

import { Redis } from "@upstash/redis";

const boardKey = (round) => `scores:${round}`;
const winnersKey = (round) => `winners:${round}`;

// Two hours of history is plenty to render "last round's winners" and to let a
// late poll settle a round nobody was watching.
const KEEP_SECONDS = 2 * 60 * 60;

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasRedis = Boolean(url && token);

/**
 * What is actually backing the board right now. The UI surfaces this, because
 * "local" means every serverless instance has its own copy and nothing is shared
 * between players — which is fine for a preview and wrong for a real board.
 */
export const storageKind = hasRedis ? "upstash" : "local";

const redis = hasRedis ? new Redis({ url, token }) : null;

// round -> (member -> best score). Module scope survives between requests in one
// server process; it deliberately does not survive a restart or reach a second
// lambda — see storageKind.
const memory = new Map();
const settled = new Map();

function localBoard(round) {
  if (!memory.has(round)) memory.set(round, new Map());
  return memory.get(round);
}

/** Record a run against a round. Only an improvement on that wallet's best counts. */
export async function submitScore({ round, member, score }) {
  if (!member || !Number.isFinite(score)) {
    throw new Error("submitScore needs a member and a numeric score");
  }

  if (hasRedis) {
    // GT: only overwrite when the new score is greater, so a bad run cannot
    // erase somebody's best inside the round.
    await redis.zadd(boardKey(round), { gt: true }, { score, member });
    await redis.expire(boardKey(round), KEEP_SECONDS);
    return;
  }

  const board = localBoard(round);
  const best = board.get(member);
  if (best === undefined || score > best) board.set(member, score);
}

/**
 * Top `count` entries, highest first, as [{ member, score }].
 * Upstash returns `withScores` as a flat [member, score, member, score, …]
 * array, which is why callers get objects instead of raw indices.
 */
export async function topScores(round, count = 3) {
  if (hasRedis) {
    const flat = await redis.zrange(boardKey(round), 0, count - 1, {
      withScores: true,
      rev: true,
    });
    return pairsToEntries(flat);
  }

  return [...localBoard(round).entries()]
    .map(([member, score]) => ({ member, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

/**
 * The winners of a finished round, settled once and then frozen.
 *
 * Settlement is lazy — the first request that notices the round is over writes
 * the result — because there is no cron here and a serverless function only runs
 * when someone asks. Freezing matters: without it the "winners" of a past round
 * would keep being recomputed, and a late-arriving score could rewrite history.
 */
export async function settleRound(round, prizes) {
  const existing = await getWinners(round);
  if (existing) return existing;

  const top = await topScores(round, prizes.length);
  const winners = top.map((row, i) => ({
    rank: i + 1,
    member: row.member,
    score: row.score,
    eth: prizes[i]?.eth ?? 0,
  }));

  if (hasRedis) {
    await redis.set(winnersKey(round), JSON.stringify(winners), { ex: KEEP_SECONDS });
  } else {
    settled.set(round, winners);
  }
  return winners;
}

export async function getWinners(round) {
  if (hasRedis) {
    const raw = await redis.get(winnersKey(round));
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }
  return settled.get(round) || null;
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
