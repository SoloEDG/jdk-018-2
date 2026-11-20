<script setup lang="ts">
import { ref, computed } from "vue";
import { Clapperboard } from "lucide-vue-next";
import { useStudio } from "../../../shared/useStudio";
import { formatTime } from "../lib/plan";

const { doc, video, invalidate } = useStudio();
const bar = ref<HTMLElement>();
let dragMode: "start" | "end" | "play" | null = null;

const span = computed(() =>
  Math.max(0, Math.min(doc.video.end, video.duration.value) - doc.video.start),
);

function clampRange() {
  const d = video.duration.value;
  doc.video.start = Math.min(Math.max(0, doc.video.start), d);
  doc.video.end = Math.min(Math.max(doc.video.start, doc.video.end), d);
}

function rangeInput() {
  clampRange();
  invalidate();
}

function fpsInput(e: Event) {
  doc.video.fps = Math.min(
    30,
    Math.max(1, Math.round(Number((e.target as HTMLInputElement).value)) || 1),
  );
  invalidate();
}

function setStart() {
  doc.video.start = Math.min(video.time.value, doc.video.end);
  invalidate();
}
function setEnd() {
  doc.video.end = Math.max(video.time.value, doc.video.start);
  invalidate();
}

function pos(e: PointerEvent): number {
  const b = bar.value!.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width));
  return ratio * video.duration.value;
}
function down(mode: "start" | "end" | "play") {
  return (e: PointerEvent) => {
    dragMode = mode;
    bar.value!.setPointerCapture(e.pointerId);
    move(e);
  };
}
function move(e: PointerEvent) {
  if (!dragMode) return;
  const t = pos(e);
  if (dragMode === "play") video.seekToTime(t);
  else if (dragMode === "start") {
    doc.video.start = Math.min(t, doc.video.end);
    invalidate();
  } else {
    doc.video.end = Math.max(t, doc.video.start);
    invalidate();
  }
}
function up() {
  dragMode = null;
}

const pct = (t: number) =>
  (video.duration.value ? (t / video.duration.value) * 100 : 0) + "%";
</script>

<template>
  <section class="panel" v-if="video.active.value">
    <div class="section-title">
      <span>04 / TIMELINE</span><Clapperboard :size="15" />
    </div>

    <div
      ref="bar"
      class="timeline-bar"
      @pointerdown="down('play')"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
    >
      <div
        class="timeline-range"
        :style="{
          left: pct(doc.video.start),
          width: pct(Math.max(0, Math.min(doc.video.end, video.duration.value) - doc.video.start)),
        }"
      />
      <i
        class="timeline-handle"
        :style="{ left: pct(doc.video.start) }"
        @pointerdown.stop="down('start')($event)"
      />
      <i
        class="timeline-handle"
        :style="{ left: pct(Math.min(doc.video.end, video.duration.value)) }"
        @pointerdown.stop="down('end')($event)"
      />
      <b class="timeline-playhead" :style="{ left: pct(video.time.value) }" />
    </div>
    <div class="range-ends">
      <span>{{ formatTime(doc.video.start) }}</span
      ><span>{{ formatTime(video.duration.value) }}</span>
    </div>

    <div class="time-inputs">
      <label
        >起点 s<input
          aria-label="起点秒"
          type="number"
          min="0"
          step="0.1"
          v-model.number="doc.video.start"
          @change="rangeInput" /></label
      ><label
        >终点 s<input
          aria-label="终点秒"
          type="number"
          min="0"
          step="0.1"
          v-model.number="doc.video.end"
          @change="rangeInput"
      /></label>
    </div>
    <div class="row hint">
      <span>拖动滑杆选择范围</span>
      <span>
        <button class="mini" @click="setStart">当前帧为起点</button
        ><button class="mini" @click="setEnd">为终点</button>
      </span>
    </div>

    <label class="field"
      >采样帧率 <b>{{ doc.video.fps }} 帧/秒 · 共 {{ video.total.value }} 帧</b
      ><input
        aria-label="采样帧率"
        type="range"
        min="1"
        max="30"
        step="1"
        :value="doc.video.fps"
        @input="fpsInput"
    /></label>
    <small class="mono muted"
      >时长 {{ span.toFixed(2) }}s · 按时刻采样，兼容可变帧率</small
    >
    <small class="muted temporal-hint" v-if="video.total.value > 600"
      >帧数较多，离线导出可能需要几分钟；可缩短范围或降低帧率。</small
    >

    <label class="field"
      >动态处理
      <select
        aria-label="动态处理"
        v-model="doc.video.temporal"
        @change="invalidate"
      >
        <option value="detail">保留细节（逐帧独立）</option>
        <option value="stable">抑制闪烁（时序平滑）</option>
      </select>
    </label>
    <label class="field" v-if="doc.video.temporal === 'stable'"
      >平滑强度 <b>{{ Math.round(doc.video.strength * 100) }}%</b
      ><input
        aria-label="平滑强度"
        type="range"
        min="0.1"
        max="0.95"
        step="0.05"
        v-model.number="doc.video.strength"
        @input="invalidate"
    /></label>
    <small class="muted temporal-hint" v-if="doc.video.temporal === 'stable'"
      >强度越高闪烁越少，但快速运动可能出现拖影；预览下方的 Δ
      变化计数可用来权衡。</small
    >
  </section>
</template>
