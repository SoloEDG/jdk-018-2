import type { Crop, Grid, Settings, VideoSettings } from "../../../shared/document";
import { glyphs } from "./charsets";
import { gridSize } from "./gridSize";
import { sample } from "./sample";
import { tone, luminance } from "./tone";
import { filteredTone } from "./temporal";

/** 一帧未经字符量化的中间结果：色调（已应用明暗规则）与原始颜色。 */
export interface RawFrame {
  tone: Float32Array;
  /** 每单元 0xRRGGBB */
  colors: Uint32Array;
  columns: number;
  rows: number;
}

/**
 * 从任意图像源（静态图片或视频当前帧）提取色调与颜色，
 * 完全沿用当前的裁剪、对比度、伽马与反转设置。
 */
export function extractRaw(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  crop: Crop,
  settings: Settings,
): RawFrame {
  const size = gridSize(
    sourceWidth * crop.width,
    sourceHeight * crop.height,
    settings.columns,
  );
  const pixels = sample(
    source,
    sourceWidth,
    sourceHeight,
    crop,
    size.columns,
    size.rows,
    settings.background,
  );
  const count = size.columns * size.rows;
  const tones = new Float32Array(count);
  const colors = new Uint32Array(count);
  for (let i = 0, p = 0; i < count; i++, p += 4) {
    const r = pixels[p]!,
      g = pixels[p + 1]!,
      b = pixels[p + 2]!;
    tones[i] = tone(
      luminance(r, g, b),
      settings.contrast,
      settings.gamma,
      settings.invert,
    );
    colors[i] = (r << 16) | (g << 8) | b;
  }
  return { tone: tones, colors, columns: size.columns, rows: size.rows };
}

export interface ComposedFrame {
  grid: Grid;
  /** 实际用于选字的色调（时序滤波后），可用于闪烁度量 */
  filtered: Float32Array;
}

/**
 * 把色调图量化为字符网格。字符选择基于滤波后的色调，
 * 颜色始终取当前帧（不做时序混合，避免颜色拖影）。
 * 预览、逐帧拖动与离线导出都经由本函数，因此对同一采样时刻结果一致。
 */
export function composeFrame(
  raws: RawFrame[],
  settings: Settings,
  revision: number,
  temporal: Pick<VideoSettings, "temporal" | "strength">,
): ComposedFrame {
  const latest = raws[raws.length - 1]!;
  const filtered = filteredTone(
    temporal.temporal,
    temporal.strength,
    raws.map((r) => r.tone),
  );
  const chars = glyphs(settings.charset, settings.custom);
  const cells = new Array(filtered.length);
  for (let i = 0; i < filtered.length; i++) {
    const t = Math.max(0, Math.min(1, filtered[i]!));
    cells[i] = {
      glyph: chars[Math.round(t * (chars.length - 1))]!,
      color: "#" + latest.colors[i]!.toString(16).padStart(6, "0"),
    };
  }
  return {
    grid: {
      columns: latest.columns,
      rows: latest.rows,
      cells,
      revision,
    },
    filtered,
  };
}
