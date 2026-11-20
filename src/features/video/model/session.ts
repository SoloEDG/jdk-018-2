import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { StudioContext } from "../../../shared/context";
import { extractRaw, composeFrame, type RawFrame } from "../../mapping/lib/frame";
import { TEMPORAL_RADIUS, countChanged } from "../../mapping/lib/temporal";
import { glyphs } from "../../mapping/lib/charsets";
import { computeSamplePlan } from "../lib/plan";
import { VideoSampler, StaleSeekError } from "../lib/sampler";

export interface VideoSession {
  active: ComputedRef<boolean>;
  /** 采样时刻表（秒），预览与导出共用 */
  plan: ComputedRef<number[]>;
  total: ComputedRef<number>;
  duration: ComputedRef<number>;
  /** 当前显示的采样序号 */
  index: Ref<number>;
  /** 当前显示的采样时刻（秒） */
  time: ComputedRef<number>;
  playing: Ref<boolean>;
  rendering: Ref<boolean>;
  /** 与上一采样帧相比字符发生变化的单元数（闪烁/拖影度量），未知为 null */
  changed: Ref<number | null>;
  seekTo: (k: number) => void;
  seekToTime: (t: number) => void;
  stepBy: (d: number) => void;
  togglePlay: () => void;
  /** 设置/裁剪变化后重渲染当前帧 */
  refresh: () => Promise<void>;
  /** 素材更换后重置会话 */
  resetForAsset: () => void;
}

const CACHE_LIMIT = 12;

export function createVideoSession(ctx: StudioContext): VideoSession {
  const { doc, busy, notice } = ctx;
  const index = ref(0);
  const playing = ref(false);
  const rendering = ref(false);
  const changed = ref<number | null>(null);

  let sampler: VideoSampler | null = null;
  let token = 0;
  let playWall = 0;
  let playIndex = 0;
  let pumping = false;
  const rawCache = new Map<number, RawFrame>();
  const filteredCache = new Map<number, Float32Array>();

  const active = computed(() => doc.asset?.kind === "video");
  const duration = computed(() => doc.asset?.duration ?? 0);
  const plan = computed(() =>
    active.value
      ? computeSamplePlan(
          doc.video.start,
          Math.min(doc.video.end, duration.value),
          doc.video.fps,
        )
      : [],
  );
  const total = computed(() => plan.value.length);
  const time = computed(() => plan.value[index.value] ?? 0);

  function videoEl(): HTMLVideoElement | null {
    return active.value ? (doc.asset!.image as HTMLVideoElement) : null;
  }

  function cacheSet<V>(map: Map<number, V>, k: number, v: V) {
    map.delete(k);
    map.set(k, v);
    if (map.size > CACHE_LIMIT) map.delete(map.keys().next().value!);
  }

  function resetForAsset() {
    token++;
    sampler?.dispose();
    playing.value = false;
    rawCache.clear();
    filteredCache.clear();
    changed.value = null;
    index.value = 0;
    sampler = active.value
      ? new VideoSampler(videoEl()!, duration.value)
      : null;
  }

  /** 取第 k 个采样的色调图（未命中则定位解码），结果与导出完全一致。 */
  async function ensureRaw(k: number, tk: number): Promise<RawFrame> {
    const hit = rawCache.get(k);
    if (hit) return hit;
    if (!sampler || tk !== token) throw new StaleSeekError();
    await sampler.seek(plan.value[k]!);
    if (tk !== token) throw new StaleSeekError();
    const asset = doc.asset!;
    const raw = extractRaw(
      videoEl()!,
      asset.width,
      asset.height,
      doc.crop,
      doc.settings,
    );
    cacheSet(rawCache, k, raw);
    return raw;
  }

  /**
   * 渲染第 k 个采样帧到预览。与离线导出共用同一 composeFrame 管线
   * 与同一张采样时刻表，因此预览显示的字符帧与导出对应时刻一致。
   */
  async function renderSample(k: number, tk: number): Promise<boolean> {
    const from = Math.max(0, k - TEMPORAL_RADIUS);
    const raws: RawFrame[] = [];
    for (let j = from; j <= k; j++) raws.push(await ensureRaw(j, tk));
    if (tk !== token) return false;
    const { grid, filtered } = composeFrame(
      raws,
      doc.settings,
      doc.revision,
      doc.video,
    );
    const prev = filteredCache.get(k - 1);
    changed.value =
      k > 0 && prev
        ? countChanged(
            prev,
            filtered,
            glyphs(doc.settings.charset, doc.settings.custom).length,
          )
        : null;
    cacheSet(filteredCache, k, filtered);
    doc.grid = grid;
    index.value = k;
    return true;
  }

  async function render(k: number) {
    const tk = token;
    rendering.value = true;
    try {
      await renderSample(k, tk);
    } catch (e) {
      if (!(e instanceof StaleSeekError) && tk === token)
        notice.value = e instanceof Error ? e.message : "视频帧渲染失败";
    } finally {
      if (tk === token) rendering.value = false;
    }
  }

  function clampIndex(k: number): number {
    return Math.max(0, Math.min(plan.value.length - 1, Math.round(k)));
  }

  function rebaseClock() {
    playWall = performance.now();
    playIndex = index.value;
  }

  function seekTo(k: number) {
    if (!plan.value.length) return;
    token++; // 让进行中的旧解码任务失效，不得覆盖新帧
    index.value = clampIndex(k);
    rebaseClock();
    void render(index.value);
  }

  function seekToTime(t: number) {
    const times = plan.value;
    let k = 0;
    while (k + 1 < times.length && times[k + 1]! <= t) k++;
    seekTo(k);
  }

  function stepBy(d: number) {
    seekTo(index.value + d);
  }

  /** 设置或裁剪变化：缓存失效，重渲染当前采样。 */
  async function refresh(): Promise<void> {
    if (!active.value) return;
    const tk = ++token;
    rawCache.clear();
    filteredCache.clear();
    changed.value = null;
    index.value = clampIndex(index.value);
    rebaseClock();
    busy.value = true;
    rendering.value = true;
    try {
      await renderSample(index.value, tk);
    } catch (e) {
      if (!(e instanceof StaleSeekError) && tk === token)
        notice.value = e instanceof Error ? e.message : "视频帧渲染失败";
    } finally {
      if (tk === token) {
        busy.value = false;
        rendering.value = false;
      }
    }
  }

  /** 播放时钟：目标采样由墙钟推出，来不及显示的采样直接跳过（允许丢帧）。 */
  function clockTarget(): number {
    const times = plan.value;
    const anchor = Math.min(playIndex, times.length - 1);
    const goal = times[anchor]! + (performance.now() - playWall) / 1000;
    let k = anchor;
    while (k + 1 < times.length && times[k + 1]! <= goal) k++;
    return k;
  }

  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (playing.value) {
        const target = clockTarget();
        if (target !== index.value) {
          const tk = token;
          rendering.value = true;
          try {
            await renderSample(target, tk);
          } catch (e) {
            if (e instanceof StaleSeekError) continue;
            notice.value = e instanceof Error ? e.message : "播放渲染失败";
            playing.value = false;
          } finally {
            if (tk === token) rendering.value = false;
          }
        } else if (index.value >= plan.value.length - 1) {
          playing.value = false; // 停在最后一帧
        } else {
          await new Promise((r) => setTimeout(r, 30));
        }
      }
    } finally {
      pumping = false;
    }
  }

  function togglePlay() {
    if (!plan.value.length) return;
    if (playing.value) {
      playing.value = false;
      token++; // 在途任务立即失效，不再写画面
      return;
    }
    if (index.value >= plan.value.length - 1) index.value = 0;
    playing.value = true;
    rebaseClock();
    void pump();
  }

  return {
    active,
    plan,
    total,
    duration,
    index,
    time,
    playing,
    rendering,
    changed,
    seekTo,
    seekToTime,
    stepBy,
    togglePlay,
    refresh,
    resetForAsset,
  };
}
