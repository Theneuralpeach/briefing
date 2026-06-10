// Deno Deploy backend for the briefing app's memo box.
// Receives a note (POST) and appends it to the Notion "📥 アプリメモ" page.
// Env vars (set in Deno Deploy dashboard):
//   NOTION_TOKEN   - Notion internal integration token (ntn_… / secret_…)
//   NOTION_PAGE_ID - the 📥 アプリメモ page id (37bd8f409f9581b0a124d5d54bde2ccb)
//   SHARED_SECRET  - same passphrase the app uses (gate against random posts)

const NOTION_TOKEN = Deno.env.get("NOTION_TOKEN") ?? "";
const PAGE_ID = (Deno.env.get("NOTION_PAGE_ID") ?? "").replace(/-/g, "");
const SECRET = Deno.env.get("SHARED_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method === "GET") return json({ ok: true, service: "briefing-memo" });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: { note?: string; secret?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (SECRET && body.secret !== SECRET) return json({ error: "unauthorized" }, 401);
  const note = (body.note ?? "").trim();
  if (!note) return json({ error: "empty" }, 400);
  const kind = (body as { kind?: string }).kind === "diary" ? "diary" : "memo";
  const icon = kind === "diary" ? "📔" : "💡";
  const now = new Date().toLocaleString("ja-JP", { timeZone: "America/Los_Angeles" });
  const r = await fetch(`https://api.notion.com/v1/blocks/${PAGE_ID}/children`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      children: [{
        object: "block",
        type: "callout",
        callout: { icon: { emoji: icon }, rich_text: [{ type: "text", text: { content: `${now}  —  ${note}` } }] },
      }],
    }),
  });
  if (!r.ok) return json({ error: "notion", detail: await r.text() }, 502);
  return json({ ok: true });
});
