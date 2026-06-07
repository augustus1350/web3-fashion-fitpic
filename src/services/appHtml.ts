import { EpochPhase } from "@prisma/client";

export interface AppPageOptions {
  baseUrl: string;
  phase: EpochPhase;
  devRoutes: boolean;
}

/** Interactive Farcaster Mini App webview: upload your FitPic from your device. */
export function renderAppPage(options: AppPageOptions): string {
  const { baseUrl, phase, devRoutes } = options;
  const isSubmission = phase === EpochPhase.SUBMISSION;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FitPic - Upload</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        background: #0d0d0f; color: #f4f4f5;
        margin: 0; padding: 20px; max-width: 480px; margin: 0 auto;
      }
      h1 { font-size: 1.4rem; margin: 0 0 4px; }
      p.sub { color: #a1a1aa; margin: 0 0 20px; font-size: 0.9rem; }
      .card { background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 18px; }
      label.drop {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 8px; border: 2px dashed #3f3f46; border-radius: 12px; padding: 28px 16px;
        text-align: center; cursor: pointer; transition: border-color .15s, background .15s;
      }
      label.drop:hover { border-color: #6366f1; background: #1c1c22; }
      label.drop span.hint { color: #a1a1aa; font-size: 0.85rem; }
      input[type=file] { display: none; }
      #preview { display: none; width: 100%; border-radius: 12px; margin-top: 14px; }
      .fid-row { display: flex; align-items: center; gap: 10px; margin-top: 16px; font-size: 0.9rem; }
      .fid-row input {
        flex: 1; background: #0d0d0f; border: 1px solid #3f3f46; color: #f4f4f5;
        border-radius: 8px; padding: 8px 10px; font-size: 0.9rem;
      }
      button.primary {
        width: 100%; margin-top: 18px; padding: 14px; border: none; border-radius: 12px;
        background: #6366f1; color: white; font-size: 1rem; font-weight: 600; cursor: pointer;
      }
      button.primary:disabled { background: #3f3f46; color: #71717a; cursor: not-allowed; }
      button.ghost {
        width: 100%; margin-top: 10px; padding: 12px; border: 1px solid #3f3f46;
        border-radius: 12px; background: transparent; color: #a1a1aa; cursor: pointer; font-size: 0.9rem;
      }
      #status { margin-top: 14px; font-size: 0.9rem; min-height: 1.2em; }
      #status.ok { color: #4ade80; } #status.err { color: #f87171; }
      .badge { display: inline-block; background: #27272a; border-radius: 999px; padding: 3px 10px; font-size: 0.75rem; color: #a1a1aa; }
    </style>
  </head>
  <body>
    <h1>FitPic</h1>
    <p class="sub">Upload your look and submit it to the current epoch.</p>
    <div class="card">
      <div class="badge" id="phaseBadge">Phase: ${escapeAttr(phase)}</div>
      <div id="uploadUi" style="${isSubmission ? "" : "display:none"}">
        <form id="form">
          <label class="drop" for="file" style="margin-top:14px">
            <strong>Tap to choose a photo</strong>
            <span class="hint">JPG or PNG, max 8 MB</span>
          </label>
          <input type="file" id="file" name="image" accept="image/*" />
          <img id="preview" alt="preview" />
          <div class="fid-row">
            <span>Farcaster FID</span>
            <input id="fid" name="fid" inputmode="numeric" placeholder="e.g. 1" />
          </div>
          <button type="submit" class="primary" id="submitBtn" disabled>Submit FitPic</button>
        </form>
      </div>
      <div id="closedUi" style="${isSubmission ? "display:none" : ""}">
        <p class="sub" style="margin-top:14px">Submissions are closed right now (current phase: ${escapeAttr(phase)}).</p>
        ${
          devRoutes
            ? `<button class="ghost" id="devSwitch">Dev: switch to submission phase</button>`
            : ""
        }
      </div>
      <div id="status"></div>
    </div>

    <script type="module">
      const BASE = ${JSON.stringify(baseUrl)};
      const fileInput = document.getElementById("file");
      const preview = document.getElementById("preview");
      const fidInput = document.getElementById("fid");
      const submitBtn = document.getElementById("submitBtn");
      const statusEl = document.getElementById("status");
      const form = document.getElementById("form");

      function setStatus(msg, kind) {
        statusEl.textContent = msg || "";
        statusEl.className = kind || "";
      }

      // Try to load Farcaster Mini App context (FID) and hide the splash.
      (async () => {
        try {
          const { sdk } = await import("https://esm.sh/@farcaster/miniapp-sdk");
          await sdk.actions.ready();
          const ctx = await sdk.context;
          const fid = ctx && ctx.user && ctx.user.fid;
          if (fid) {
            fidInput.value = String(fid);
            fidInput.readOnly = true;
          }
        } catch (e) {
          // Opened in a normal browser - user enters FID manually.
        }
      })();

      if (fileInput) {
        fileInput.addEventListener("change", () => {
          const f = fileInput.files && fileInput.files[0];
          if (!f) { submitBtn.disabled = true; preview.style.display = "none"; return; }
          preview.src = URL.createObjectURL(f);
          preview.style.display = "block";
          submitBtn.disabled = false;
        });
      }

      if (form) {
        form.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const f = fileInput.files && fileInput.files[0];
          const fid = parseInt(fidInput.value, 10);
          if (!f) { setStatus("Choose a photo first.", "err"); return; }
          if (!Number.isInteger(fid) || fid <= 0) { setStatus("Enter a valid Farcaster FID.", "err"); return; }

          submitBtn.disabled = true;
          setStatus("Uploading...", "");
          try {
            const fd = new FormData();
            fd.append("image", f);
            fd.append("fid", String(fid));
            const res = await fetch(BASE + "/api/submissions/upload", { method: "POST", body: fd });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              const m = (json && json.error && (json.error.message || json.error)) || ("HTTP " + res.status);
              setStatus("Failed: " + m, "err");
              submitBtn.disabled = false;
              return;
            }
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
          setStatus("Switching phase...", "");
          try {
            const res = await fetch(BASE + "/frames/dev/submission-phase", { method: "POST" });
            if (res.ok) { location.reload(); }
            else { setStatus("Could not switch phase (HTTP " + res.status + ")", "err"); }
          } catch (e) {
            setStatus("Network error switching phase.", "err");
          }
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
