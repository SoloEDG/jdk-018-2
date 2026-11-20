/**
 * 时序滤波的历史半径：当前帧最多与之前 2 个采样帧混合。
 * 窗口是因果的（只看过去），因此实时播放、逐帧拖动与离线导出
 * 对同一采样序号得到的过滤结果完全一致。
 */
export const TEMPORAL_RADIUS = 2;
export type TemporalMode = "detail" | "stable";

/**
 * 各窗口长度对应的归一化权重（最旧→最新）。
 * 长度 3 取二项式权重 [1,2,1]/4：对周期为 2 的帧间抖动（字符在阈值
 * 两侧来回翻转的最常见形态）其交错加权和恒为 0，即被恰好抵消；
 * 同时拖影被限制在最多 2 个采样帧内。
 */
const WINDOW_WEIGHTS: number[][] = [[1], [0.5, 0.5], [0.25, 0.5, 0.25]];

/**
 * 对色调图做因果时序滤波。
 * @param tones 按时间从旧到新排列的色调图，最后一项是当前帧，
 *              长度不超过 TEMPORAL_RADIUS + 1；序列开头窗口自然截断。
 * @returns detail 模式或 strength 为 0 时原样返回当前帧（最大细节，
 *          相邻帧可能闪烁）；stable 模式返回
 *          out = (1-s)·当前帧 + s·(窗口加权和)，
 *          强度越高闪烁越少，但快速运动的边缘会留下拖影。
 *          返回的数组可能共享输入引用，调用方不得修改。
 */
export function filteredTone(
  mode: TemporalMode,
  strength: number,
  tones: Float32Array[],
): Float32Array {
  const current = tones[tones.length - 1]!;
  if (mode === "detail" || strength <= 0 || tones.length === 1) return current;
  const s = Math.min(0.95, Math.max(0, strength));
  const weights = WINDOW_WEIGHTS[tones.length - 1]!;
  const out = new Float32Array(current.length);
  for (let i = 0; i < current.length; i++) {
    let avg = 0;
    for (let j = 0; j < tones.length; j++) avg += weights[j]! * tones[j]![i]!;
    out[i] = (1 - s) * current[i]! + s * avg;
  }
  return out;
}

/**
 * 量化后字符发生变化的单元数量——闪烁/拖影的可验证度量：
 * 静止画面下该值越小说明闪烁抑制越有效；运动画面下该值滞后越多说明拖影越明显。
 */
export function countChanged(
  previous: Float32Array,
  next: Float32Array,
  levels: number,
): number {
  const last = Math.max(1, levels) - 1;
  let changed = 0;
  for (let i = 0; i < next.length; i++) {
    const a = Math.round(Math.max(0, Math.min(1, previous[i]!)) * last);
    const b = Math.round(Math.max(0, Math.min(1, next[i]!)) * last);
    if (a !== b) changed++;
  }
  return changed;
}
