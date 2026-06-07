export interface FrameButton {
  label: string;
  action?: "post" | "link" | "mint";
  target?: string;
}

export interface FramePageOptions {
  baseUrl: string;
  imageUrl: string;
  title: string;
  subtitle?: string;
  postUrl: string;
  buttons: FrameButton[];
  state?: string;
  textInput?: boolean;
  textInputPlaceholder?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Warpcast reads fc:* tags from `name`, NOT `property` (OpenGraph uses property). */
function fcNameMeta(tag: string, content: string): string {
  return `<meta name="${tag}" content="${escapeHtml(content)}" />`;
}

function buildMiniAppEmbedPayload(
  appUrl: string,
  imageUrl: string,
  title: string,
): string {
  const payload = {
    version: "1",
    imageUrl,
    button: {
      title: "Open FitPic",
      action: {
        type: "launch_frame",
        name: title.slice(0, 32),
        url: `${appUrl.replace(/\/$/, "")}/frames`,
        splashImageUrl: imageUrl,
        splashBackgroundColor: "#111111",
      },
    },
  };

  return JSON.stringify(payload);
}

/** Warpcast embed tool scrapes fc:miniapp (and fc:frame JSON on root URL). */
function buildMiniAppEmbedMeta(
  appUrl: string,
  imageUrl: string,
  title: string,
  options?: { frameCompat?: boolean },
): string {
  const json = buildMiniAppEmbedPayload(appUrl, imageUrl, title);
  const tags = [fcNameMeta("fc:miniapp", json)];
  if (options?.frameCompat !== false) {
    tags.push(fcNameMeta("fc:frame", json));
  }
  return tags.join("\n    ");
}

/** Root URL for Warpcast Embed Tool - miniapp meta only, no interactive frame tags. */
export function renderEmbedPage(options: {
  baseUrl: string;
  imageUrl: string;
  title: string;
  subtitle?: string;
}): string {
  const { baseUrl, imageUrl, title, subtitle } = options;
  const framesUrl = `${baseUrl.replace(/\/$/, "")}/frames`;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(subtitle ?? title)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:url" content="${escapeHtml(baseUrl)}" />
    ${buildMiniAppEmbedMeta(baseUrl, imageUrl, title)}
    <style>
      body { font-family: system-ui, sans-serif; max-width: 420px; margin: 2rem auto; padding: 0 1rem; }
      img { width: 100%; border-radius: 12px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle ?? "")}</p>
    <img src="${escapeHtml(imageUrl)}" alt="FitPic preview" />
    <p><a href="${escapeHtml(framesUrl)}">Open FitPic Frame</a></p>
  </body>
</html>`;
}

export function renderFramePage(options: FramePageOptions): string {
  const {
    baseUrl,
    imageUrl,
    title,
    subtitle,
    postUrl,
    buttons,
    state,
    textInput,
    textInputPlaceholder,
  } = options;

  const buttonMeta = buttons
    .map((button, index) => {
      const i = index + 1;
      const action = button.action ?? "post";
      const lines = [
        fcNameMeta(`fc:frame:button:${i}`, button.label),
        fcNameMeta(`fc:frame:button:${i}:action`, action),
      ];
      if (action === "link" && button.target) {
        lines.push(fcNameMeta(`fc:frame:button:${i}:target`, button.target));
      }
      return lines.join("\n    ");
    })
    .join("\n    ");

  const inputMeta = textInput
    ? `\n    ${fcNameMeta("fc:frame:input:text", textInputPlaceholder ?? "Paste image URL")}`
    : "";

  const stateMeta = state ? `\n    ${fcNameMeta("fc:frame:state", state)}` : "";

  const previewButtons = buttons
    .map((button) => `<li>${escapeHtml(button.label)}</li>`)
    .join("");

  const inputPreview = textInput
    ? `<p><em>Text field:</em> ${escapeHtml(textInputPlaceholder ?? "Paste image URL")}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(subtitle ?? title)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:url" content="${escapeHtml(postUrl)}" />
    ${buildMiniAppEmbedMeta(baseUrl, imageUrl, title, { frameCompat: false })}
    ${fcNameMeta("fc:frame", "vNext")}
    ${fcNameMeta("fc:frame:image", imageUrl)}
    ${fcNameMeta("fc:frame:image:aspect_ratio", "1.91:1")}
    ${fcNameMeta("fc:frame:post_url", postUrl)}${stateMeta}${inputMeta}
    ${buttonMeta}
    <style>
      body { font-family: system-ui, sans-serif; max-width: 420px; margin: 2rem auto; padding: 0 1rem; }
      img { width: 100%; border-radius: 12px; }
      .note { background: #f4f4f5; border-radius: 8px; padding: 12px; font-size: 14px; }
      ul { padding-left: 1.2rem; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle ?? "")}</p>
    <img src="${escapeHtml(imageUrl)}" alt="FitPic preview" />
    ${inputPreview}
    <p><strong>Frame buttons (only in Warpcast app):</strong></p>
    <ul>${previewButtons}</ul>
    <div class="note">
      <p><strong>Browser = preview only.</strong> Test embed in Warpcast:</p>
      <p><a href="https://warpcast.com/~/developers/mini-apps/embed">Mini App Embed Tool</a></p>
      <p><code>${escapeHtml(postUrl)}</code></p>
    </div>
  </body>
</html>`;
}
