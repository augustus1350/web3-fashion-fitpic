export interface AdminPageOptions {
  baseUrl: string;
}

/** Owner-only moderation webview: review the feed and remove submissions. */
export function renderAdminPage(options: AdminPageOptions): string {
  const { baseUrl } = options;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FitPic - Moderation</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        background: #0d0d0f; color: #f4f4f5;
        margin: 0 auto; padding: 18px; max-width: 520px;
      }
      h1 { font-size: 1.4rem; margin: 0 0 4px; }
      p.sub { color: #a1a1aa; margin: 0 0 14px; font-size: 0.9rem; }
      label.lbl { display: block; font-size: 0.85rem; color: #a1a1aa; margin: 12px 0 6px; }
      input.text {
        width: 100%; background: #18181b; border: 1px solid #3f3f46; color: #f4f4f5;
        border-radius: 10px; padding: 11px 12px; font-size: 0.92rem;
      }
      input.text:focus { outline: none; border-color: #6366f1; }
      button.reload {
        width: 100%; margin-top: 12px; padding: 12px; border: 1px solid #3f3f46;
        border-radius: 10px; background: transparent; color: #d4d4d8; cursor: pointer; font-size: 0.9rem;
      }
      .item {
        display: flex; gap: 12px; align-items: center; background: #18181b;
        border: 1px solid #27272a; border-radius: 14px; padding: 12px; margin-top: 12px;
      }
      .item img { width: 84px; height: 84px; object-fit: cover; border-radius: 10px; background: #0d0d0f; flex: 0 0 auto; }
      .item .info { flex: 1; min-width: 0; font-size: 0.82rem; color: #a1a1aa; }
      .item .info .hash { color: #d4d4d8; word-break: break-all; }
      button.remove {
        padding: 9px 12px; border: none; border-radius: 10px; background: #b91c1c;
        color: white; font-weight: 600; cursor: pointer; font-size: 0.85rem; flex: 0 0 auto;
      }
      button.remove:disabled { background: #3f3f46; color: #71717a; cursor: not-allowed; }
      #status { margin-top: 14px; font-size: 0.9rem; min-height: 1.2em; }
      .ok { color: #4ade80; } .err { color: #f87171; } .busy { color: #a1a1aa; }
    </style>
  </head>
  <body>
    <h1>FitPic · Moderation</h1>
    <p class="sub">Owner only. Remove submissions that break the rules (e.g. not a FitPic). Only founder FIDs are authorized.</p>

    <label class="lbl" for="fid">Your founder FID</label>
    <input class="text" id="fid" inputmode="numeric" placeholder="e.g. 1" />
    <label class="lbl" for="reason">Removal reason</label>
    <input class="text" id="reason" value="Not a FitPic / guideline violation" />
    <button class="reload" id="reloadBtn">Reload feed</button>

    <div id="list"></div>
    <div id="status"></div>

    <script type="module">
      const BASE = ${JSON.stringify(baseUrl)};
      const $ = (id) => document.getElementById(id);
      const statusEl = $("status");
      function setStatus(msg, kind) { statusEl.textContent = msg || ""; statusEl.className = kind || ""; }
      function errMessage(json, res) {
        return (json && json.error && (json.error.message || json.error)) || ("HTTP " + res.status);
      }
      function getFid() { const n = parseInt($("fid").value, 10); return Number.isInteger(n) && n > 0 ? n : null; }

      (async () => {
        try {
          const { sdk } = await import("https://esm.sh/@farcaster/miniapp-sdk");
          await sdk.actions.ready();
          const ctx = await sdk.context;
          const fid = ctx && ctx.user && ctx.user.fid;
          if (fid) { $("fid").value = String(fid); $("fid").readOnly = true; }
        } catch (e) { /* plain browser: enter FID manually */ }
      })();

      async function removeItem(castHash, btn) {
        const fid = getFid();
        const reason = $("reason").value.trim();
        if (!fid) { setStatus("Enter your founder FID.", "err"); return; }
        if (reason.length < 3) { setStatus("Enter a removal reason.", "err"); return; }
        btn.disabled = true;
        setStatus("Removing...", "busy");
        try {
          const res = await fetch(BASE + "/api/admin/remove", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ adminFid: fid, castHash, reason }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) { setStatus("Failed: " + errMessage(json, res), "err"); btn.disabled = false; return; }
          const card = btn.closest(".item");
          if (card) card.remove();
          setStatus("Removed " + castHash, "ok");
        } catch (e) { setStatus("Network error while removing.", "err"); btn.disabled = false; }
      }

      async function loadFeed() {
        setStatus("Loading feed...", "busy");
        $("list").innerHTML = "";
        try {
          const res = await fetch(BASE + "/api/feed?limit=50");
          const json = await res.json().catch(() => ({}));
          if (!res.ok) { setStatus("Could not load feed.", "err"); return; }
          const feed = Array.isArray(json.data) ? json.data : [];
          if (!feed.length) { setStatus("No submissions in the feed.", "busy"); return; }
          for (const item of feed) {
            const div = document.createElement("div");
            div.className = "item";
            const img = document.createElement("img");
            img.src = item.imageUrl; img.alt = "submission";
            const info = document.createElement("div");
            info.className = "info";
            info.innerHTML = '<div class="hash">' + item.farcasterCastHash + '</div>' +
              '<div>FID ' + (item.user && item.user.tier ? item.user.tier : '?') + ' · ' + (item.totalVotes ?? 0) + ' votes</div>';
            const btn = document.createElement("button");
            btn.className = "remove"; btn.textContent = "Remove";
            btn.addEventListener("click", () => removeItem(item.farcasterCastHash, btn));
            div.appendChild(img); div.appendChild(info); div.appendChild(btn);
            $("list").appendChild(div);
          }
          setStatus(feed.length + " submissions loaded.", "ok");
        } catch (e) { setStatus("Network error loading feed.", "err"); }
      }

      $("reloadBtn").addEventListener("click", loadFeed);
      loadFeed();
    </script>
  </body>
</html>`;
}
