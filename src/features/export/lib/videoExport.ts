import type {
  Asset,
  Crop,
  Settings,
  VideoSettings,
} from "../../../shared/document";
import { extractRaw, composeFrame, type RawFrame } from "../../mapping/lib/frame";
import { TEMPORAL_RADIUS } from "../../mapping/lib/temporal";
import { gridRows } from "../../preview/lib/rows";
import { VideoSampler } from "../../video/lib/sampler";

export class ExportCancelled extends Error {
  constructor() {
    super("导出已取消");
    this.name = "ExportCancelled";
  }
}

export interface VideoExportResult {
  /** 每帧纯文本（行以 \n 连接），长度等于采样数 */
  frames: string[];
  /** 彩色开启时：每帧所有单元的 6 位 hex 颜色按行优先拼接 */
  colors: string[] | null;
  /** 每个采样帧对应的源视频时刻（秒） */
  times: number[];
  columns: number;
  rows: number;
}

export interface VideoExportOptions {
  asset: Asset;
  crop: Crop;
  settings: Settings;
  video: VideoSettings;
  plan: number[];
  color: boolean;
  revision: number;
  /** 设置或素材在导出过程中被修改时返回 true，导出立即中止 */
  isStale: () => boolean;
  onProgress: (done: number, total: number) => void;
  signal: { cancelled: boolean };
}

/**
 * 离线导出：使用独立的视频元素，按采样时刻表逐帧顺序定位解码，
 * 每一个选定采样时刻都会被渲染——实时播放中跳过的帧不会在这里漏掉。
 * 渲染经由与预览完全相同的 composeFrame 管线，因此导出帧与预览一致。
 */
export async function runVideoExport(
  opts: VideoExportOptions,
): Promise<VideoExportResult> {
  const { asset, plan } = opts;
  const el = document.createElement("video");
  el.muted = true;
  el.playsInline = true;
  el.preload = "auto";
  el.src = asset.url;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      el.removeEventListener("loadedmetadata", ok);
      el.removeEventListener("error", bad);
    };
    const ok = () => {
      cleanup();
      resolve();
    };
    const bad = () => {
      cleanup();
      reject(new Error("无法读取视频，导出中止"));
    };
    el.addEventListener("loadedmetadata", ok);
    el.addEventListener("error", bad);
  });
  const sampler = new VideoSampler(el, asset.duration);
  const history: RawFrame[] = [];
  const frames: string[] = [];
  const colors: string[] = [];
  let columns = 0;
  let rows = 0;
  const checkPoint = () => {
    if (opts.signal.cancelled) throw new ExportCancelled();
    if (opts.isStale()) throw new Error("设置或视频已更改，导出已中止");
  };
  try {
    for (let k = 0; k < plan.length; k++) {
      checkPoint();
      await sampler.seek(plan[k]!);
      checkPoint();
      const raw = extractRaw(
        el,
        asset.width,
        asset.height,
        opts.crop,
        opts.settings,
      );
      history.push(raw);
      if (history.length > TEMPORAL_RADIUS + 1) history.shift();
      // 历史从采样 0 起顺序累积，窗口对齐方式与预览一致
      const { grid } = composeFrame(
        history.slice(),
        opts.settings,
        opts.revision,
        opts.video,
      );
      columns = grid.columns;
      rows = grid.rows;
      frames.push(gridRows(grid).join("\n"));
      if (opts.color)
        colors.push(grid.cells.map((c) => c.color.slice(1)).join(""));
      opts.onProgress(k + 1, plan.length);
    }
  } finally {
    sampler.dispose();
    el.removeAttribute("src");
    el.load();
  }
  return {
    frames,
    colors: opts.color ? colors : null,
    times: plan.slice(),
    columns,
    rows,
  };
}
