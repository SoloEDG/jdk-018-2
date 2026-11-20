import { ref } from "vue";
import { useStudio } from "../../../shared/useStudio";
import { textContent } from "../lib/text";
import { download, exportName } from "../lib/download";
import { drawGrid } from "../../preview";
import { runVideoExport, ExportCancelled } from "../lib/videoExport";
import { buildPlayerHtml } from "../lib/player";
export function useExport() {
  const { doc, notice, busy, video } = useStudio();
  const exporting = ref(false);
  const exportDone = ref(0);
  const exportTotal = ref(0);
  let cancelFlag: { cancelled: boolean } | null = null;

  function ready() {
    return doc.grid && doc.grid.revision === doc.revision && !busy.value;
  }
  function saveText() {
    if (!ready()) return;
    download(
      new Blob([textContent(doc.grid!)], { type: "text/plain;charset=utf-8" }),
      exportName(doc.asset?.name ?? "art", "txt"),
    );
    notice.value = "文本已导出";
  }
  async function copy() {
    if (!ready()) return;
    try {
      await navigator.clipboard.writeText(textContent(doc.grid!));
      notice.value = "字符画已复制";
    } catch {
      notice.value = "无法访问剪贴板，请使用文本导出";
    }
  }
  function png() {
    if (!ready()) return;
    const c = document.createElement("canvas");
    drawGrid(c, doc.grid!, doc.settings.color, doc.settings.background);
    c.toBlob((b) => {
      if (b) download(b, exportName(doc.asset?.name ?? "art", "png"));
    }, "image/png");
  }

  /**
   * 离线导出整段短片：对开始时的设置与采样计划做快照，
   * 逐帧顺序解码，每一个选定采样时刻都会被包含。
   */
  async function exportVideo(kind: "txt" | "html") {
    if (exporting.value || doc.asset?.kind !== "video") return;
    const snapshot = {
      asset: doc.asset,
      crop: { ...doc.crop },
      settings: { ...doc.settings },
      video: { ...doc.video },
      plan: video.plan.value.slice(),
      revision: doc.revision,
    };
    if (!snapshot.plan.length) return;
    if (snapshot.plan.length > 2000) {
      notice.value = `选区共 ${snapshot.plan.length} 帧，超过 2000 帧上限，请缩短时间范围或降低帧率`;
      return;
    }
    exporting.value = true;
    exportDone.value = 0;
    exportTotal.value = snapshot.plan.length;
    const flag = { cancelled: false };
    cancelFlag = flag;
    try {
      const result = await runVideoExport({
        ...snapshot,
        color: snapshot.settings.color,
        isStale: () =>
          doc.revision !== snapshot.revision || doc.asset !== snapshot.asset,
        onProgress: (done, total) => {
          exportDone.value = done;
          exportTotal.value = total;
        },
        signal: flag,
      });
      const base = snapshot.asset.name;
      if (kind === "txt") {
        download(
          new Blob([result.frames.join("\n\f\n")], {
            type: "text/plain;charset=utf-8",
          }),
          exportName(base, "txt"),
        );
      } else {
        const html = buildPlayerHtml(
          result,
          base,
          snapshot.settings.background,
        );
        download(
          new Blob([html], { type: "text/html;charset=utf-8" }),
          exportName(base, "html"),
        );
      }
      notice.value = `短片已导出（${result.frames.length} 帧）`;
    } catch (e) {
      if (e instanceof ExportCancelled)
        notice.value = `导出已取消（完成 ${exportDone.value}/${exportTotal.value} 帧）`;
      else notice.value = e instanceof Error ? e.message : "导出失败";
    } finally {
      exporting.value = false;
      cancelFlag = null;
    }
  }
  function cancelExport() {
    if (cancelFlag) cancelFlag.cancelled = true;
  }
  return {
    doc,
    busy,
    video,
    ready,
    saveText,
    copy,
    png,
    exporting,
    exportDone,
    exportTotal,
    exportVideo,
    cancelExport,
  };
}
