/**
 * 计算采样时刻表：从 start 起按 fps 均匀采样，并保证精确包含 end。
 *
 * 采样时刻允许不是源视频的整帧时刻——取帧按时间进行，由解码器
 * 解析到该时刻实际对应的帧，因此对可变帧率（VFR）素材同样成立；
 * 预览与导出使用同一张时刻表，保证两者逐帧一致。
 */
export function computeSamplePlan(
  start: number,
  end: number,
  fps: number,
): number[] {
  const s = Math.max(0, start);
  const e = Math.max(s, end);
  const f = Math.min(60, Math.max(1, Math.round(fps) || 1));
  const interval = 1 / f;
  const times: number[] = [];
  // 均匀部分：k/f <= e - s（小容差吸收浮点误差）
  const n = Math.floor((e - s) / interval + 1e-6);
  for (let k = 0; k <= n; k++) times.push(roundUs(s + k * interval));
  // 尾部非整帧：若 end 与最后一个均匀采样点存在真实间隔（>1ms），
  // 补上精确的 end，保证选区末尾也被导出
  const last = times[times.length - 1]!;
  if (e - last > 1e-3) times.push(roundUs(e));
  return times.length ? times : [roundUs(s)];
}

function roundUs(t: number): number {
  return Math.round(t * 1e6) / 1e6;
}

/** 把秒格式化为 m:ss.cc */
export function formatTime(t: number): string {
  const total = Math.max(0, t);
  let m = Math.floor(total / 60);
  let s = total - m * 60;
  if (s >= 59.995) {
    s = 0;
    m += 1;
  }
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}
