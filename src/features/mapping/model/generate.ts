import type { StudioDocument, Grid } from "../../../shared/document";
import { extractRaw, composeFrame } from "../lib/frame";
export function generate(doc: StudioDocument): Grid | null {
  if (!doc.asset) return null;
  const raw = extractRaw(
    doc.asset.image,
    doc.asset.width,
    doc.asset.height,
    doc.crop,
    doc.settings,
  );
  return composeFrame([raw], doc.settings, doc.revision, {
    temporal: "detail",
    strength: 0,
  }).grid;
}
