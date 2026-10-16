// Claims worker: Telegram webhook → consent-based project claim.
// Flow: bot added to project Telegram channel → /claim <project-slug> →
// wallet link sent → signature verified off-bot → claim row → EAS attestation.

export interface Env {
  DB: D1Database;
  INDEXER: string;
  WEB: string;
  TELEGRAM_BOT_TOKEN: string;
}

interface TgUpdate {
  message?: {
    chat: { id: number; title?: string };
    from?: { id: number; username?: string };
    text?: string;
  };
}

async function tg(env: Env, method: string, body: unknown) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function handle(env: Env, u: TgUpdate) {
  const msg = u.message;
  if (!msg?.text) return;
  const chatId = msg.chat.id;

  if (msg.text.startsWith("/claim")) {
    const slug = msg.text.split(/\s+/)[1];
    if (!slug) {
      await tg(env, "sendMessage", { chat_id: chatId, text: "Usage: /claim <project-slug>" });
      return;
    }
    const project = await env.DB.prepare("SELECT * FROM claims WHERE project=?").bind(slug).first<{
      project: string;
      status: string;
    }>();
    if (!project) {
      await tg(env, "sendMessage", { chat_id: chatId, text: `Project "${slug}" not found in the graph.` });
      return;
    }
    if (project.status !== "unclaimed") {
      await tg(env, "sendMessage", { chat_id: chatId, text: `Project "${slug}" is already ${project.status}.` });
      return;
    }
    await env.DB.prepare("UPDATE claims SET status='pending', telegram_chat=? WHERE project=?")
      .bind(String(chatId), slug)
      .run();
    await tg(env, "sendMessage", {
      chat_id: chatId,
      text: `Claim started for "${slug}". Link the treasury wallet at ${env.WEB || env.INDEXER}/claim/${slug} — an EAS attestation finalizes the claim.`,
    });
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/telegram" && req.method === "POST") {
      const update = (await req.json()) as TgUpdate;
      await handle(env, update);
      return new Response("ok");
    }
    if (url.pathname === "/health") return Response.json({ ok: true });
    return new Response("not found", { status: 404 });
  },
};
