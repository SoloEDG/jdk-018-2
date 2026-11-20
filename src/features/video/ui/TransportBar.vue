<script setup lang="ts">
import { Play, Pause, SkipBack, SkipForward } from "lucide-vue-next";
import { useStudio } from "../../../shared/useStudio";
import { formatTime } from "../lib/plan";
const { video } = useStudio();
function scrub(e: Event) {
  video.seekTo(Number((e.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="transport">
    <button aria-label="上一帧" title="上一帧" @click="video.stepBy(-1)">
      <SkipBack :size="14" /></button
    ><button
      class="play"
      aria-label="播放或暂停"
      title="播放 / 暂停"
      @click="video.togglePlay"
    >
      <Pause v-if="video.playing.value" :size="14" /><Play v-else :size="14" /></button
    ><button aria-label="下一帧" title="下一帧" @click="video.stepBy(1)">
      <SkipForward :size="14" /></button
    ><input
      class="scrub"
      aria-label="逐帧拖动"
      type="range"
      min="0"
      :max="Math.max(0, video.total.value - 1)"
      :value="video.index.value"
      @input="scrub"
    /><span class="mono time"
      >{{ formatTime(video.time.value) }} /
      {{ formatTime(video.duration.value) }}</span
    ><span class="mono muted frame-no"
      >帧 {{ video.index.value + 1 }}/{{ video.total.value }}</span
    >
  </div>
</template>
