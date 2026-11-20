import type { Crop } from "../../../shared/document";
/**
 * 把任意图像源（静态图片或视频当前帧）按裁剪区域缩采样到字符网格，
 * 视频与图片共用此函数，保证每一帧沿用同一套裁剪规则。
 */
export function sample(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  crop: Crop,
  columns: number,
  rows: number,
  background: string,
): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = columns;
  c.height = rows;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = background;
  g.fillRect(0, 0, columns, rows);
  g.drawImage(
    source,
    crop.x * sourceWidth,
    crop.y * sourceHeight,
    crop.width * sourceWidth,
    crop.height * sourceHeight,
    0,
    0,
    columns,
    rows,
  );
  return g.getImageData(0, 0, columns, rows).data;
}
