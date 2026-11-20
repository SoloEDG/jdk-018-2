import { reactive, ref, provide, watch } from "vue";
import { createDocument } from "../shared/defaults";
import { studioKey, type StudioContext } from "../shared/context";
import { generate } from "../features/mapping";
import { createVideoSession } from "../features/video";
export function useWorkspace() {
  const doc = reactive(createDocument());
  const busy = ref(false),
    notice = ref("所有处理均在你的浏览器中完成");
  const ctx = { doc, busy, notice, invalidate, video: null } as unknown as StudioContext;
  const video = createVideoSession(ctx);
  ctx.video = video;
  let timer: ReturnType<typeof setTimeout>;
  function invalidate() {
    doc.revision++;
    busy.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (doc.asset?.kind === "video") {
        void video.refresh();
        return;
      }
      try {
        doc.grid = generate(doc);
      } catch (e) {
        notice.value = e instanceof Error ? e.message : "生成失败";
      } finally {
        busy.value = false;
      }
    }, 60);
  }
  watch(() => doc.asset, (asset, old) => {
    old?.release?.();
    video.resetForAsset();
  });
  watch(() => doc.settings.background, invalidate);
  provide(studioKey, ctx);
  return { doc, busy, notice };
}
