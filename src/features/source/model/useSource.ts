import { ref } from "vue";
import { useStudio } from "../../../shared/useStudio";
import { decodeImage, decodeVideo } from "../lib/decode";
import { demoImage } from "../lib/demo";
export function useSource() {
  const { doc, notice, invalidate } = useStudio();
  const loading = ref(false);
  let ticket = 0;
  async function load(url: string, name: string) {
    const id = ++ticket;
    loading.value = true;
    try {
      const asset = await decodeImage(url, name);
      if (id !== ticket) return;
      doc.asset = asset;
      doc.crop = { x: 0, y: 0, width: 1, height: 1 };
      invalidate();
      notice.value = "图片已载入";
    } catch (e) {
      if (id === ticket)
        notice.value = e instanceof Error ? e.message : "无法读取图片";
    } finally {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      if (id === ticket) loading.value = false;
    }
  }
  async function loadVideo(f: File) {
    const id = ++ticket;
    loading.value = true;
    const url = URL.createObjectURL(f);
    try {
      const asset = await decodeVideo(url, f.name);
      if (id !== ticket) {
        asset.release?.();
        return;
      }
      doc.asset = asset;
      doc.crop = { x: 0, y: 0, width: 1, height: 1 };
      // 保留用户的帧率与动态处理偏好，仅重置时间范围
      doc.video.start = 0;
      doc.video.end = asset.duration;
      invalidate();
      notice.value = `视频已载入 · 时长 ${asset.duration.toFixed(2)}s`;
    } catch (e) {
      URL.revokeObjectURL(url);
      if (id === ticket)
        notice.value = e instanceof Error ? e.message : "无法读取视频";
    } finally {
      if (id === ticket) loading.value = false;
    }
  }
  function file(f?: File) {
    if (!f) return;
    if (/^image\/(png|jpeg|webp)$/.test(f.type)) {
      if (f.size > 20 * 1024 * 1024) {
        notice.value = "请选择 20 MB 以内的 PNG、JPEG 或 WebP 图片";
        return;
      }
      void load(URL.createObjectURL(f), f.name);
      return;
    }
    if (f.type.startsWith("video/")) {
      if (f.size > 500 * 1024 * 1024) {
        notice.value = "请选择 500 MB 以内的视频";
        return;
      }
      void loadVideo(f);
      return;
    }
    notice.value = "请选择图片或视频文件";
  }
  return {
    doc,
    loading,
    file,
    demo: () => load(demoImage(), "Sunset ridge.png"),
  };
}
