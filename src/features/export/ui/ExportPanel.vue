<script setup lang="ts">
import { Download, Copy, ArrowUpRight, Film, X } from "lucide-vue-next";
import { useExport } from "../model/useExport";
const e = useExport();
</script>
<template>
  <section class="export-bar">
    <div>
      <span class="eyebrow">READY TO SHARE</span>
      <h3>带走你的字符作品</h3>
      <small>文本保留完整字符布局，PNG 保留当前配色。</small>
    </div>
    <div class="export-actions">
      <button class="secondary" :disabled="!e.ready()" @click="e.copy">
        <Copy :size="15" /> 复制字符</button
      ><button class="secondary" :disabled="!e.ready()" @click="e.png">
        PNG <ArrowUpRight :size="15" /></button
      ><button class="primary" :disabled="!e.ready()" @click="e.saveText">
        <Download :size="16" /> 导出 .TXT
      </button>
    </div>
  </section>
  <section class="export-bar video-export" v-if="e.video.active.value">
    <div>
      <span class="eyebrow">OFFLINE RENDER</span>
      <h3>导出字符短片</h3>
      <small
        >逐帧离线渲染 {{ e.video.total.value }} 帧（{{
          e.video.plan.value[0]?.toFixed(2) ?? "0.00"
        }}s – {{ e.video.plan.value[e.video.total.value - 1]?.toFixed(2) ?? "0.00" }}s）， 与预览逐帧一致；播放中跳过的帧不会缺失。</small
      >
    </div>
    <div class="export-actions" v-if="!e.exporting.value">
      <button class="secondary" @click="e.exportVideo('txt')">
        <Film :size="15" /> 帧序列 .TXT</button
      ><button class="primary" @click="e.exportVideo('html')">
        <Download :size="16" /> 导出 HTML 短片
      </button>
    </div>
    <div class="export-progress" v-else>
      <div class="progress-track">
        <div
          class="progress-fill"
          :style="{
            width:
              (e.exportTotal.value
                ? (e.exportDone.value / e.exportTotal.value) * 100
                : 0) + '%',
          }"
        />
      </div>
      <span class="mono"
        >{{ e.exportDone.value }}/{{ e.exportTotal.value }} 帧</span
      >
      <button class="secondary" @click="e.cancelExport">
        <X :size="14" /> 取消
      </button>
    </div>
  </section>
</template>
