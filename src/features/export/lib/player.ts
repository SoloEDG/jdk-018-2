import type { VideoExportResult } from "./videoExport";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 生成自包含的 HTML 字符短片播放器：内嵌全部帧数据，
 * 双击即可离线播放，无需任何网络或依赖。
 * 播放按各帧真实采样时刻推进（首尾非整帧间隔也被保留）。
 */
export function buildPlayerHtml(
  result: VideoExportResult,
  name: string,
  background: string,
): string {
  const data = {
    c: result.columns,
    r: result.rows,
    t: result.times,
    f: result.frames,
    k: result.colors,
    bg: background,
  };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const title = escapeHtml(name.replace(/\.[^.]+$/, "") + " · ASCII 短片");
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;background:#111216;color:#e8e8e5;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100vh;justify-content:center;gap:14px}
  canvas{box-shadow:0 14px 45px #0006;max-width:96vw;height:auto}
  .bar{display:flex;align-items:center;gap:12px;width:min(96vw,${result.columns * 8}px)}
  button{background:#d4eb98;border:0;color:#263017;font:600 13px system-ui;padding:8px 14px;border-radius:5px;cursor:pointer}
  input[type=range]{flex:1;accent-color:#d2e999}
  .mono{font:11px ui-monospace,monospace;color:#9ba19f;white-space:nowrap}
</style>
</head>
<body>
<canvas id="c" role="img" aria-label="字符短片"></canvas>
<div class="bar">
  <button id="play">▶ 播放</button>
  <input id="scrub" type="range" min="0" max="${result.frames.length - 1}" value="0" aria-label="逐帧拖动">
  <span class="mono" id="label"></span>
</div>
<script>
const D = ${json};
const W = 8, H = 16;
const cv = document.getElementById("c");
const g = cv.getContext("2d");
cv.width = D.c * W;
cv.height = D.r * H;
const n = D.f.length;
const tail = n > 1 ? D.t[n-1] - D.t[n-2] : 0;
const total = D.t[n-1] + (tail > 0 ? tail : 1/12);
const playBtn = document.getElementById("play");
const scrub = document.getElementById("scrub");
const label = document.getElementById("label");
let i = 0, playing = false, wall = 0, base = 0;
function draw(k) {
  g.fillStyle = D.bg;
  g.fillRect(0, 0, cv.width, cv.height);
  g.font = "14px monospace";
  g.textBaseline = "middle";
  g.textAlign = "center";
  const rows = D.f[k].split("\\n");
  const packed = D.k ? D.k[k] : null;
  for (let y = 0; y < rows.length; y++) {
    const chars = Array.from(rows[y]);
    for (let x = 0; x < chars.length; x++) {
      const idx = y * D.c + x;
      g.fillStyle = packed ? "#" + packed.substr(idx * 6, 6) : "#e9eceb";
      g.fillText(chars[x], x * W + 4, y * H + 8);
    }
  }
  label.textContent = D.t[k].toFixed(2) + "s · " + (k + 1) + "/" + n;
  scrub.value = k;
}
function tick() {
  if (!playing) return;
  let t = base + (performance.now() - wall) / 1000;
  if (t >= total) { base = 0; wall = performance.now(); t = 0; }
  let k = i;
  while (k + 1 < n && D.t[k + 1] <= t) k++;
  while (k > 0 && D.t[k] > t) k--;
  if (k !== i) { i = k; draw(i); }
  requestAnimationFrame(tick);
}
function toggle() {
  playing = !playing;
  playBtn.textContent = playing ? "⏸ 暂停" : "▶ 播放";
  if (playing) { base = D.t[i]; wall = performance.now(); requestAnimationFrame(tick); }
}
playBtn.addEventListener("click", toggle);
cv.addEventListener("click", toggle);
document.addEventListener("keydown", e => { if (e.code === "Space") { e.preventDefault(); toggle(); } });
scrub.addEventListener("input", () => { i = Number(scrub.value); base = D.t[i]; wall = performance.now(); draw(i); });
draw(0);
</script>
</body>
</html>
`;
}
