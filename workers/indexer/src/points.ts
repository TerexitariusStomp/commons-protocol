// Points ledger helpers — wallet-bound, D1-persisted allocation points.
// Adapted from tbsoc/pastry POINT_RULES, implemented as real server state.

export const POINT_RULES = {
  welcome: 250,
  perPledgedUsd: 10,
  perEndowedUsd: 100,
  createProject: 200,
  artizenAlumni: 1000,
  proposeFund: 300,
  curate: 150,
} as const;

export const PROPOSE_MIN_POINTS = 1000;
export const SEASON_DAYS = 90;

/** Current season row; creates the next one when expired. */
export async function currentSeason(db: D1Database): Promise<{ id: number; start_ts: number; end_ts: number }> {
  const now = Math.floor(Date.now() / 1000);
  const last = await db
    .prepare("SELECT id, start_ts, end_ts FROM seasons ORDER BY id DESC LIMIT 1")
    .first<{ id: number; start_ts: number; end_ts: number }>();
  if (last && last.end_ts > now) return last;
  const id = (last?.id ?? 0) + 1;
  const start = now;
  const end = now + SEASON_DAYS * 86400;
  await db.prepare("INSERT INTO seasons(id,start_ts,end_ts) VALUES(?,?,?)").bind(id, start, end).run();
  return { id, start_ts: start, end_ts: end };
}

export async function pointsBalance(db: D1Database, wallet: string): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(SUM(delta),0) b FROM points_events WHERE lower(wallet)=?")
    .bind(wallet.toLowerCase())
    .first<{ b: number }>();
  return row?.b ?? 0;
}

/** Award points; `welcome` is auto-awarded on first-ever event for a wallet. */
export async function award(
  db: D1Database,
  wallet: string,
  delta: number,
  reason: string,
  ref?: string,
  season?: number,
) {
  const w = wallet.toLowerCase();
  const seen = await db
    .prepare("SELECT 1 FROM points_events WHERE lower(wallet)=? LIMIT 1")
    .bind(w)
    .first();
  if (!seen)
    await db
      .prepare("INSERT INTO points_events(wallet,delta,reason,season) VALUES(?,?,?,?)")
      .bind(w, POINT_RULES.welcome, "welcome", season ?? null)
      .run();
  await db
    .prepare("INSERT INTO points_events(wallet,delta,reason,ref,season) VALUES(?,?,?,?,?)")
    .bind(w, delta, reason, ref ?? null, season ?? null)
    .run();
}
