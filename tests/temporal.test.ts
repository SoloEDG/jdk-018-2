import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filteredTone,
  countChanged,
  TEMPORAL_RADIUS,
} from "../src/features/mapping/lib/temporal.ts";

/** 模拟预览/导出共用的窗口规则：保留最近 TEMPORAL_RADIUS+1 帧 */
function runSequence(
  frames: number[],
  mode: "detail" | "stable",
  strength: number,
): number[] {
  const history: Float32Array[] = [];
  const out: number[] = [];
  for (const v of frames) {
    history.push(new Float32Array([v]));
    if (history.length > TEMPORAL_RADIUS + 1) history.shift();
    out.push(filteredTone(mode, strength, history.slice())[0]!);
  }
  return out;
}

const quantize = (t: number, levels: number) =>
  Math.round(Math.max(0, Math.min(1, t)) * (levels - 1));

const closeTo = (actual: number, expected: number) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-5,
    `${actual} ≈ ${expected}`,
  );

test("detail 模式：原样输出当前帧（最大细节）", () => {
  const frames = [0.1, 0.9, 0.2, 0.8];
  const out = runSequence(frames, "detail", 0.8);
  frames.forEach((v, i) => closeTo(out[i]!, v));
});

test("strength 为 0 时 stable 等价于 detail", () => {
  const frames = [0.3, 0.7, 0.4];
  const out = runSequence(frames, "stable", 0);
  frames.forEach((v, i) => closeTo(out[i]!, v));
});

test("闪烁抑制：阈值附近来回抖动的输入被稳定下来", () => {
  // 色调围绕 0.38 以 ±0.02 交替（跨过 7/18≈0.389 的量化阈值），levels=10
  const frames = [0.36, 0.4, 0.36, 0.4, 0.36, 0.4];
  const detail = runSequence(frames, "detail", 0).map((t) => quantize(t, 10));
  assert.deepEqual(detail, [3, 4, 3, 4, 3, 4]); // 每帧都在闪烁

  const stable = runSequence(frames, "stable", 0.9).map((t) => quantize(t, 10));
  // 二项式窗口把周期-2 抖动抵消到阈值同侧：从第 2 帧起字符不再翻转
  assert.deepEqual(stable.slice(1), [3, 3, 3, 3, 3]);

  // 可验证度量：stable 的相邻帧变化数严格小于 detail
  const countSeq = (seq: number[]) =>
    seq.slice(1).filter((v, i) => v !== seq[i]).length;
  assert.ok(countSeq(stable) < countSeq(detail));
});

test("抖动振幅被压缩到 (1-s) 倍", () => {
  // 均值恰在阈值上的最坏情况：线性滤波无法消除越界，但振幅被压缩
  const frames = [0.4, 0.6, 0.4, 0.6, 0.4, 0.6];
  const stable = runSequence(frames, "stable", 0.9);
  for (let k = 2; k < stable.length; k++)
    assert.ok(Math.abs(stable[k]! - 0.5) <= 0.0101, `帧 ${k}: ${stable[k]}`);
});

test("运动拖影可量化：阶跃输入下 stable 滞后，detail 立即响应", () => {
  const frames = [0, 0, 0, 1, 1, 1];
  const detail = runSequence(frames, "detail", 0);
  closeTo(detail[3]!, 1); // detail 立即跳到新值

  const stable = runSequence(frames, "stable", 0.9);
  // 阶跃后第 1 帧：窗口 [0,0,1] → 0.1·1 + 0.9·0.25 = 0.325（仍偏旧值 = 拖影）
  closeTo(stable[3]!, 0.325);
  // 第 2 帧：窗口 [0,1,1] → 0.1·1 + 0.9·0.75 = 0.775
  closeTo(stable[4]!, 0.775);
  // 第 3 帧：窗口 [1,1,1] → 完全跟上，拖影不超过 TEMPORAL_RADIUS 帧
  closeTo(stable[5]!, 1);
});

test("countChanged：统计量化后字符变化的单元数", () => {
  const a = new Float32Array([0.1, 0.4, 0.9]);
  const b = new Float32Array([0.1, 0.6, 0.9]);
  assert.equal(countChanged(a, b, 10), 1);
  assert.equal(countChanged(a, a, 10), 0);
});

test("序列开头窗口截断：首帧不受历史影响", () => {
  const out = runSequence([0.2, 0.8], "stable", 0.9);
  closeTo(out[0]!, 0.2); // 首帧只有自身，保持清晰
  // 第 2 帧：窗口 [0.2,0.8] 等权 → 0.1·0.8 + 0.9·0.5 = 0.53
  closeTo(out[1]!, 0.53);
});
