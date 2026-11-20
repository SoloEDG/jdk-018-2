import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlayerHtml } from "../src/features/export/lib/player.ts";

const result = {
  frames: ["ab\ncd", "xy\nzw"],
  colors: ["ff000000ff00ff000000ff00", "000000ffffffffffff000000"],
  times: [0.5, 1.0],
  columns: 2,
  rows: 2,
};

test("播放器包含帧数据、采样时刻与画布尺寸", () => {
  const html = buildPlayerHtml(result, "demo.mp4", "#101216");
  assert.ok(html.includes('"c":2'));
  assert.ok(html.includes('"t":[0.5,1]'));
  assert.ok(html.includes("ab\\ncd") || html.includes("ab\ncd"));
  assert.ok(html.includes("#101216"));
  assert.ok(html.includes("<canvas"));
});

test("帧数据中的 </script> 被转义，不会提前闭合脚本", () => {
  const evil = {
    ...result,
    frames: ["</script><script>alert(1)</script>"],
  };
  const html = buildPlayerHtml(evil, "x", "#000");
  const scripts = html.match(/<script>/g) ?? [];
  // 只有播放器本身一个开标签；注入的闭合标签已被 < 转义
  assert.equal(scripts.length, 1);
  assert.ok(!html.includes("</script><script>alert"));
});

test("标题中的 HTML 特殊字符被转义", () => {
  const html = buildPlayerHtml(result, '<img src=x onerror=alert(1)>', "#000");
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img src=x"));
});
