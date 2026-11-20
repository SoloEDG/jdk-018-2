<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from "vue";
import type { Asset, Crop } from "../../../shared/document";
const props = defineProps<{ asset: Asset; crop: Crop }>();
const host = ref<HTMLElement>();
function mount() {
  if (props.asset.kind === "video" && host.value)
    host.value.replaceChildren(props.asset.image);
}
onMounted(mount);
watch(
  () => props.asset,
  () => nextTick(mount),
);
</script>
<template>
  <div class="crop-image">
    <img
      v-if="asset.kind === 'image'"
      :src="asset.url"
      :alt="asset.name"
      draggable="false"
    />
    <div v-else ref="host" class="crop-video" />
    <div
      class="crop-box"
      :style="{
        left: crop.x * 100 + '%',
        top: crop.y * 100 + '%',
        width: crop.width * 100 + '%',
        height: crop.height * 100 + '%',
      }"
    >
      <i /><i /><i /><i />
    </div>
  </div>
</template>
