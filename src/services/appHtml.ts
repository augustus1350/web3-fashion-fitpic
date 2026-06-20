import { EpochPhase } from "@prisma/client";

export interface AppPageOptions {
  baseUrl: string;
  phase: EpochPhase;
  devRoutes: boolean;
}

/** Interactive Farcaster Mini App webview: submit a FitPic by linking a cast. */
export function renderAppPage(options: AppPageOptions): string {
  const { baseUrl } = options;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FitPic - Submit a look</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        background: #0d0d0f; color: #f4f4f5;
        margin: 0 auto; padding: 20px; max-width: 480px;
      }
      h1 { font-size: 1.4rem; margin: 0 0 4px; }
      p.sub { color: #a1a1aa; margin: 0 0 18px; font-size: 0.9rem; }
      .card { background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 18px; }
      .badge { display: inline-block; background: #27272a; border-radius: 999px; padding: 3px 10px; font-size: 0.75rem; color: #a1a1aa; margin-bottom: 6px; }
      ol.steps { margin: 12px 0 16px; padding-left: 1.2rem; color: #d4d4d8; font-size: 0.88rem; }
      ol.steps li { margin-bottom: 4px; }
      label.lbl { display: block; font-size: 0.85rem; color: #a1a1aa; margin: 14px 0 6px; }
      input.text {
        width: 100%; background: #0d0d0f; border: 1px solid #3f3f46; color: #f4f4f5;
        border-radius: 10px; padding: 11px 12px; font-size: 0.92rem;
      }
      input.text:focus { outline: none; border-color: #6366f1; }
      #preview { display: none; width: 100%; border-radius: 12px; margin-top: 14px; }
      button.primary {
        width: 100%; margin-top: 16px; padding: 14px; border: none; border-radius: 12px;
        background: #6366f1; color: white; font-size: 1rem; font-weight: 600; cursor: pointer;
      }
      button.primary:disabled { background: #3f3f46; color: #71717a; cursor: not-allowed; }
      button.ghost {
        width: 100%; margin-top: 10px; padding: 12px; border: 1px solid #3f3f46;
        border-radius: 12px; background: transparent; color: #a1a1aa; cursor: pointer; font-size: 0.9rem;
      }
      #status { margin-top: 14px; font-size: 0.9rem; min-height: 1.2em; }
      #status.ok { color: #4ade80; } #status.err { color: #f87171; } #status.busy { color: #a1a1aa; }
    </style>
  </head>
  <body>
    <h1>FitPic</h1>
    <p class="sub">Link a FitPic you posted on Farcaster. Your cast image gets entered into the current epoch.</p>
    <div class="card">
      <div id="submitUi">
        <ol class="steps">
          <li>Post your FitPic as a cast on Farcaster (with the photo).</li>
          <li>Open the cast, tap share, and copy its link.</li>
          <li>Paste the link below and submit.</li>
        </ol>
        <form id="form">
          <label class="lbl" for="castUrl">Farcaster cast link</label>
          <input class="text" id="castUrl" name="castUrl" type="url"
            placeholder="https://warpcast.com/yourname/0x..." autocomplete="off" />
          <img id="preview" alt="resolved cast image" />
          <label class="lbl" for="fid">Your Farcaster FID</label>
          <input class="text" id="fid" name="fid" inputmode="numeric" placeholder="e.g. 1" />
          <button type="button" class="ghost" id="previewBtn">Preview image</button>
          <button type="submit" class="primary" id="submitBtn">Submit FitPic</button>
        </form>
      </div>
      <p class="sub" style="margin-top:16px">
        Already submitted? <a href="${escapeAttr(baseUrl.replace(/\/$/, ""))}/frames" style="color:#818cf8">Open the frame to browse &amp; vote →</a>
      </p>
      <div id="status"></div>
    </div>

    <script type="module">
      const BASE = ${JSON.stringify(baseUrl)};
      const castInput = document.getElementById("castUrl");
      const fidInput = document.getElementById("fid");
      const preview = document.getElementById("preview");
      const previewBtn = document.getElementById("previewBtn");
      const submitBtn = document.getElementById("submitBtn");
      const statusEl = document.getElementById("status");
      const form = document.getElementById("form");

      function setStatus(msg, kind) {
        statusEl.textContent = msg || "";
        statusEl.className = kind || "";
      }
      function errMessage(json, res) {
        return (json && json.error && (json.error.message || json.error)) || ("HTTP " + res.status);
      }

      (async () => {
        try {
          const { sdk } = await import("https://esm.sh/@farcaster/miniapp-sdk");
          await sdk.actions.ready();
          const ctx = await sdk.context;
          const fid = ctx && ctx.user && ctx.user.fid;
          if (fid) { fidInput.value = String(fid); fidInput.readOnly = true; }
        } catch (e) {
          // Normal browser: user enters FID manually.
        }
      })();

      async function doPreview() {
        const castUrl = castInput.value.trim();
        if (!castUrl) { setStatus("Paste a cast link first.", "err"); return; }
        previewBtn.disabled = true;
        setStatus("Resolving image...", "busy");
        try {
          const res = await fetch(BASE + "/api/cast/preview", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ castUrl }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) { setStatus("Preview failed: " + errMessage(json, res), "err"); return; }
          preview.src = json.data.imageUrl;
          preview.style.display = "block";
          setStatus("Image found. Submit to enter it.", "ok");
        } catch (e) {
          setStatus("Network error during preview.", "err");
        } finally {
          previewBtn.disabled = false;
        }
      }

      if (previewBtn) previewBtn.addEventListener("click", doPreview);

      if (form) {
        form.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const castUrl = castInput.value.trim();
          const fid = parseInt(fidInput.value, 10);
          if (!castUrl) { setStatus("Paste your cast link.", "err"); return; }
          if (!Number.isInteger(fid) || fid <= 0) { setStatus("Enter a valid Farcaster FID.", "err"); return; }

          submitBtn.disabled = true;
          setStatus("Submitting...", "busy");
          try {
            const res = await fetch(BASE + "/api/submissions/from-cast", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ castUrl, fid }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) { setStatus("Failed: " + errMessage(json, res), "err"); submitBtn.disabled = false; return; }
            preview.src = json.data.imageUrl;
            preview.style.display = "block";
            setStatus("FitPic submitted! It is now in the feed.", "ok");
          } catch (e) {
            setStatus("Network error: " + (e && e.message ? e.message : e), "err");
            submitBtn.disabled = false;
          }
        });
      }

      const devSwitch = document.getElementById("devSwitch");
      if (devSwitch) {
        devSwitch.addEventListener("click", async () => {
          setStatus("Switching phase...", "busy");
          try {
            const res = await fetch(BASE + "/frames/dev/submission-phase", { method: "POST" });
            if (res.ok) { location.reload(); }
            else { setStatus("Could not switch phase (HTTP " + res.status + ")", "err"); }
          } catch (e) { setStatus("Network error switching phase.", "err"); }
        });
      }
    </script>
  </body>
</html>`;
}

function escapeAttr(value: string): string {
  return value.replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;",
  );
}
