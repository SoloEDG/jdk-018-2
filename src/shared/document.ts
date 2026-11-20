export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Asset {
  kind: "image" | "video";
  name: string;
  url: string;
  width: number;
  height: number;
  /** 静态图为 HTMLImageElement；视频为用于取帧的 HTMLVideoElement */
  image: HTMLImageElement | HTMLVideoElement;
  /** 视频时长（秒），静态图为 0 */
  duration: number;
  /** 释放对象 URL 与解码资源 */
  release?: () => void;
}
export interface Settings {
  columns: number;
  charset: string;
  custom: string;
  contrast: number;
  gamma: number;
  invert: boolean;
  color: boolean;
  background: string;
}
export interface VideoSettings {
  /** 选区起点（秒），允许非整帧时刻 */
  start: number;
  /** 选区终点（秒），允许非整帧时刻 */
  end: number;
  /** 采样帧率：每秒提取的字符帧数 */
  fps: number;
  /** detail=保留细节（逐帧独立）；stable=抑制相邻帧闪烁（时序平滑） */
  temporal: "detail" | "stable";
  /** 平滑强度 0..0.95，仅 stable 模式生效；越高越稳，但快速运动更易拖影 */
  strength: number;
}
export interface Cell {
  glyph: string;
  color: string;
}
export interface Grid {
  columns: number;
  rows: number;
  cells: Cell[];
  revision: number;
}
export interface StudioDocument {
  asset: Asset | null;
  crop: Crop;
  settings: Settings;
  video: VideoSettings;
  grid: Grid | null;
  revision: number;
}
