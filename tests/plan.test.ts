import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSamplePlan } from "../src/features/video/lib/plan.ts";

test("整帧边界：均匀覆盖并包含首尾", () => {
  const plan = computeSamplePlan(0, 1, 10);
  assert.equal(plan.length, 11);
  assert.equal(plan[0], 0);
  assert.equal(plan[10], 1);
  for (let k = 0; k <= 10; k++) assert.ok(Math.abs(plan[k]! - k / 10) < 1e-9);
});

test("非整帧起点：从精确起点开始等距采样", () => {
  const plan = computeSamplePlan(0.37, 2.0, 10);
  assert.equal(plan[0], 0.37);
  assert.ok(Math.abs(plan[1]! - 0.47) < 1e-9);
  // 2.0 - 0.37 = 1.63，最后一个均匀点为 0.37 + 1.6 = 1.97，余 0.03 > 1ms → 补上精确终点
  assert.equal(plan[plan.length - 2], 1.97);
  assert.equal(plan[plan.length - 1], 2.0);
});

test("终点落在采样网格上：不重复追加", () => {
  const plan = computeSamplePlan(0.1, 0.5, 10);
  assert.deepEqual(plan, [0.1, 0.2, 0.3, 0.4, 0.5]);
});

test("起点等于终点：单帧计划", () => {
  assert.deepEqual(computeSamplePlan(1.5, 1.5, 12), [1.5]);
});

test("浮点尘埃被清理：30fps 时刻精确到微秒", () => {
  const plan = computeSamplePlan(0, 1, 30);
  assert.equal(plan.length, 31);
  assert.equal(plan[1], 0.033333);
  assert.equal(plan[10], 0.333333);
  assert.equal(plan[30], 1);
});

test("计划单调递增且不越界", () => {
  const plan = computeSamplePlan(0.83, 3.19, 12);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i]! > plan[i - 1]!);
  assert.ok(plan[0]! >= 0.83 && plan[plan.length - 1]! <= 3.19);
});

test("非法输入被钳制", () => {
  assert.deepEqual(computeSamplePlan(-1, -0.5, 10), [0]);
  assert.equal(computeSamplePlan(0, 2, 0)[1], 1); // fps 最小为 1
});
