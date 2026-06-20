import { EpochPhase } from "@prisma/client";

export interface AppPageOptions {
  baseUrl: string;
  phase: EpochPhase;
  devRoutes: boolean;
}

/**
 * Interactive Farcaster Mini App webview. Two views:
 *  - Submit: link a FitPic cast.
 *  - Browse & vote: page through submissions and vote.
 */
export function renderAppPage(options: AppPageOptions): string {
  const { baseUrl } = options;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FitPic</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        background: #0d0d0f; color: #f4f4f5;
        margin: 0 auto; padding: 18px; max-width: 480px;
      }
      h1 { font-size: 1.4rem; margin: 0 0 4px; }
      p.sub { color: #a1a1aa; margin: 0 0 14px; font-size: 0.9rem; }
      .tabs { display: flex; gap: 8px; margin-bottom: 14px; }
      .tab {
        flex: 1; padding: 10px; border: 1px solid #27272a; border-radius: 10px;
        background: #18181b; color: #a1a1aa; font-size: 0.9rem; font-weight: 600; cursor: pointer;
      }
      .tab.active { background: #6366f1; color: white; border-color: #6366f1; }
      .card { background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 18px; }
      ol.steps { margin: 0 0 14px; padding-left: 1.2rem; color: #d4d4d8; font-size: 0.88rem; }
      ol.steps li { margin-bottom: 4px; }
      label.lbl { display: block; font-size: 0.85rem; color: #a1a1aa; margin: 14px 0 6px; }
      input.text {
        width: 100%; background: #0d0d0f; border: 1px solid #3f3f46; color: #f4f4f5;
        border-radius: 10px; padding: 11px 12px; font-size: 0.92rem;
      }
      input.text:focus { outline: none; border-color: #6366f1; }
      img.preview { display: none; width: 100%; border-radius: 12px; margin-top: 14px; }
      img.fit { display: block; width: 100%; max-height: 65vh; border-radius: 12px; background: #0d0d0f; object-fit: contain; }
      .meta { display: flex; justify-content: space-between; align-items: center; margin: 12px 2px; font-size: 0.9rem; color: #d4d4d8; }
      .row { display: flex; gap: 10px; }
      button.primary {
        flex: 1; margin-top: 14px; padding: 13px; border: none; border-radius: 12px;
        background: #6366f1; color: white; font-size: 1rem; font-weight: 600; cursor: pointer;
      }
      button.primary:disabled { background: #3f3f46; color: #71717a; cursor: not-allowed; }
      button.ghost {
        flex: 1; margin-top: 14px; padding: 13px; border: 1px solid #3f3f46;
        border-radius: 12px; background: transparent; color: #d4d4d8; cursor: pointer; font-size: 0.95rem;
      }
      button.wide { width: 100%; }
      #status, #vstatus { margin-top: 12px; font-size: 0.9rem; min-height: 1.2em; }
      .ok { color: #4ade80; } .err { color: #f87171; } .busy { color: #a1a1aa; }
      .hidden { display: none; }
    </style>
  </head>
  <body>
    <h1>FitPic</h1>
    <p class="sub">Submit a FitPic you posted on Farcaster, or vote on the community feed.</p>

    <div class="tabs">
      <button class="tab active" id="tabSubmit">Submit</button>
      <button class="tab" id="tabBrowse">Browse &amp; vote</button>
    </div>

    <label class="lbl" for="fid" style="margin-top:0">Your Farcaster FID</label>
    <input class="text" id="fid" inputmode="numeric" placeholder="e.g. 1" />

    <!-- SUBMIT VIEW -->
    <div class="card" id="submitView" style="margin-top:14px">
      <ol class="steps">
        <li>Post your FitPic as a cast on Farcaster (with the photo).</li>
        <li>Open the cast, tap share, and copy its link.</li>
        <li>Paste the link below and submit.</li>
      </ol>
      <label class="lbl" for="castUrl">Farcaster cast link</label>
      <input class="text" id="castUrl" type="url"
        placeholder="https://warpcast.com/yourname/0x..." autocomplete="off" />
      <img id="preview" class="preview" alt="resolved cast image" />
      <div class="row">
        <button type="button" class="ghost" id="previewBtn">Preview</button>
        <button type="button" class="primary" id="submitBtn">Submit FitPic</button>
      </div>
      <div id="status"></div>
    </div>

    <!-- BROWSE VIEW -->
    <div class="card hidden" id="browseView" style="margin-top:14px">
      <img id="fitImg" class="fit" alt="submitted FitPic" />
      <div class="meta">
        <span id="counter">–</span>
        <span id="votes">–</span>
      </div>
      <div class="row">
        <button type="button" class="primary" id="voteBtn">Vote 🔥</button>
        <button type="button" class="ghost" id="skipBtn">Skip ⏭</button>
      </div>
      <button type="button" class="ghost wide" id="reloadBtn" style="margin-top:10px">Reload feed</button>
      <div id="vstatus"></div>
    </div>

    <script type="module">
      const BASE = ${JSON.stringify(baseUrl)};
      const $ = (id) => document.getElementById(id);
      const fidInput = $("fid");

      function setStatus(el, msg, kind) { el.textContent = msg || ""; el.className = kind || ""; }
      function errMessage(json, res) {
        return (json && json.error && (json.error.message || json.error)) || ("HTTP " + res.status);
      }
      function getFid() { const n = parseInt(fidInput.value, 10); return Number.isInteger(n) && n > 0 ? n : null; }

      (async () => {
        try {
          const { sdk } = await import("https://esm.sh/@farcaster/miniapp-sdk");
          await sdk.actions.ready();
          const ctx = await sdk.context;
          const fid = ctx && ctx.user && ctx.user.fid;
          if (fid) { fidInput.value = String(fid); fidInput.readOnly = true; }
        } catch (e) { /* plain browser: enter FID manually */ }
      })();

      // ---- Tabs ----
      function showTab(which) {
        const submit = which === "submit";
        $("tabSubmit").classList.toggle("active", submit);
        $("tabBrowse").classList.toggle("active", !submit);
        $("submitView").classList.toggle("hidden", !submit);
        $("browseView").classList.toggle("hidden", submit);
        if (!submit && feed === null) loadFeed();
      }
      $("tabSubmit").addEventListener("click", () => showTab("submit"));
      $("tabBrowse").addEventListener("click", () => showTab("browse"));

      // ---- Submit view ----
      const preview = $("preview");
      $("previewBtn").addEventListener("click", async () => {
        const castUrl = $("castUrl").value.trim();
        if (!castUrl) { setStatus($("status"), "Paste a cast link first.", "err"); return; }
        $("previewBtn").disabled = true;
        setStatus($("status"), "Resolving image...", "busy");
        try {
          const res = await fetch(BASE + "/api/cast/preview", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ castUrl }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) { setStatus($("status"), "Preview failed: " + errMessage(json, res), "err"); return; }
          preview.src = json.data.imageUrl; preview.style.display = "block";
          setStatus($("status"), "Image found. Submit to enter it.", "ok");
        } catch (e) { setStatus($("status"), "Network error during preview.", "err"); }
        finally { $("previewBtn").disabled = false; }
      });

      $("submitBtn").addEventListener("click", async () => {
        const castUrl = $("castUrl").value.trim();
        const fid = getFid();
        if (!castUrl) { setStatus($("status"), "Paste your cast link.", "err"); return; }
        if (!fid) { setStatus($("status"), "Enter a valid Farcaster FID.", "err"); return; }
        $("submitBtn").disabled = true;
        setStatus($("status"), "Submitting...", "busy");
        try {
          const res = await fetch(BASE + "/api/submissions/from-cast", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ castUrl, fid }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) { setStatus($("status"), "Failed: " + errMessage(json, res), "err"); $("submitBtn").disabled = false; return; }
          preview.src = json.data.imageUrl; preview.style.display = "block";
          setStatus($("status"), "FitPic submitted! It is now in the feed.", "ok");
          feed = null; // force reload next time browse opens
        } catch (e) {
          setStatus($("status"), "Network error: " + (e && e.message ? e.message : e), "err");
          $("submitBtn").disabled = false;
        }
      });

      // ---- Browse & vote view ----
      let feed = null;
      let idx = 0;

      function renderCard() {
        if (!feed || feed.length === 0) {
          $("fitImg").removeAttribute("src");
          $("counter").textContent = "No submissions yet";
          $("votes").textContent = "";
          $("voteBtn").disabled = true; $("skipBtn").disabled = true;
          return;
        }
        idx = ((idx % feed.length) + feed.length) % feed.length;
        const item = feed[idx];
        $("fitImg").src = item.imageUrl;
        $("counter").textContent = "Look " + (idx + 1) + "/" + feed.length;
        $("votes").textContent = (item.totalVotes ?? 0) + " votes";
        $("voteBtn").disabled = false;
        $("skipBtn").disabled = feed.length < 2;
      }

      async function loadFeed() {
        setStatus($("vstatus"), "Loading feed...", "busy");
        try {
          const res = await fetch(BASE + "/api/feed?limit=30");
          const json = await res.json().catch(() => ({}));
          if (!res.ok) { setStatus($("vstatus"), "Could not load feed.", "err"); return; }
          feed = Array.isArray(json.data) ? json.data : [];
          idx = 0; renderCard();
          setStatus($("vstatus"), feed.length ? "" : "No submissions yet — be the first!", feed.length ? "" : "busy");
        } catch (e) { setStatus($("vstatus"), "Network error loading feed.", "err"); }
      }

      $("skipBtn").addEventListener("click", () => {
        if (feed && feed.length) { idx += 1; renderCard(); setStatus($("vstatus"), "", ""); }
      });
      $("reloadBtn").addEventListener("click", loadFeed);

      $("voteBtn").addEventListener("click", async () => {
        const fid = getFid();
        if (!fid) { setStatus($("vstatus"), "Enter a valid Farcaster FID to vote.", "err"); return; }
        if (!feed || !feed.length) return;
        const item = feed[idx];
        $("voteBtn").disabled = true;
        setStatus($("vstatus"), "Voting...", "busy");
        try {
          const res = await fetch(BASE + "/api/votes/cast", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ fid, castHash: item.farcasterCastHash }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) { setStatus($("vstatus"), "Vote failed: " + errMessage(json, res), "err"); $("voteBtn").disabled = false; return; }
          item.totalVotes = (item.totalVotes ?? 0) + 1;
          setStatus($("vstatus"), "Vote counted! Next look →", "ok");
          idx += 1; renderCard();
        } catch (e) {
          setStatus($("vstatus"), "Network error while voting.", "err");
          $("voteBtn").disabled = false;
        }
      });
    </script>
  </body>
</html>`;
}
