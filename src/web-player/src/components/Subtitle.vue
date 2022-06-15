<template>
  <div>
    <template v-for="sub in subtitleItems">
      <div v-if="currentTime >= sub.from && currentTime <= sub.to" class="subtitle-item">{{ sub.content }}</div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { SubtitleRaw } from '../../../bilibili-api-type'

const subtitleData = ref<SubtitleRaw[]>([])
const currentTime = ref(0)
let media: HTMLVideoElement | null

const subtitleItems = computed(() => {
  if (subtitleData.value?.length > 0) {
    return subtitleData.value[0].data
  } else {
    return []
  }
})

function onMediaTimeUpdate (ev: Event) {
  currentTime.value = (ev.target as HTMLVideoElement).currentTime
}

function init (subtitleRaw: SubtitleRaw[], mediaEl: HTMLVideoElement) {
  subtitleData.value = subtitleRaw
  media = mediaEl
  media.removeEventListener('timeupdate', onMediaTimeUpdate)
  media.addEventListener('timeupdate', onMediaTimeUpdate)
}

function clear () {
  subtitleData.value = []
}

onBeforeUnmount(() => {
  media?.removeEventListener('timeupdate', onMediaTimeUpdate)
})

defineExpose({
  init,
  clear
})
</script>

<style scoped>
.subtitle-item {
  position: absolute;
  bottom: 1em;
  margin: 0 auto;
  left: 50%;
  transform: translate(-50%, -50%);

  background: rgba(0, 0, 0, 0.4);
  font-size: 1.5em;
  white-space: normal;
  padding: 2px 12px 2px 8px;
  border-radius: 2px;
  line-height: 1.5;
  word-wrap: break-word;
  color: white
}
</style>