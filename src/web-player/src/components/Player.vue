<template>
  <div>
    输入哔哩哔哩网址：<input type="text" style="width: 30em;" v-model="inputUrl"> <button @click="playUrl">播放</button>

    <h2>{{ videoList.title }}</h2>

    <div>
      <div v-for="page in videoList.list" @click="playPage(page)" class="page-item" :class="{ 'selected': currentItem === page }">
        {{ `${page.page}. ${page.title}` }}
      </div>
    </div>

    <div>
      视频编码：
      <select v-model="perferCodec">
        <option :value="7">avc</option>
        <option :value="12">hevc</option>
        <option :value="13">av1</option>
      </select>

      <span v-if="currentCodec > 0" style="margin-left: 1em;">实际编码：{{ CODEC_MAP[currentCodec] }}</span>
    </div>

    <div>
      分辨率：{{ statics.resolution }}
    </div>

    <div>
      <video ref="videoEl" autoplay preload="none" controls="true">
      </video>
    </div>
  </div>
</template>

<script lang="ts">
declare var dashjs: any
</script>

<script lang="ts" setup>
import { ref, reactive, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import axios from 'axios'
import { VideoInfo, VideoItem, PlayurlData } from '../../../bilibili-api-type'

const CODECID_AVC = 7
const CODECID_HEVC = 12
const CODECID_AV1 = 13

const CODEC_MAP = {
  [CODECID_AVC.toString()]: 'avc',
  [CODECID_HEVC.toString()]: 'hevc',
  [CODECID_AV1.toString()]: 'av1'
}

const inputUrl = ref('https://www.bilibili.com/video/BV1qM4y1w716')

let perferCodecLocal = localStorage.getItem('BILIBILI_PLAYER_PERFER_CODEC') || 7

let videoList = ref({
  title: '无标题',
  list: []
} as VideoInfo)

let videoEl = ref<HTMLVideoElement>()
let currentItem = ref<VideoItem>()
let currentPage = ref<PlayurlData>()
let perferCodec = ref(Number(perferCodecLocal))
let currentCodec = ref(0)
let player: any
let isRunning = true

const statics = reactive({
  bufferLevel: '',
  framerate: '',
  reportedBitrate: '',
  resolution: '',
  codecs: ''
})

/* Methods */
async function playUrl () {
  const url = inputUrl.value
  let { data } = await axios.get('/api/get-video-list', { params: { url } })

  videoList.value = data

  if (videoList.value.list.length > 0) {
    playPage(videoList.value.list[0])
  }
}

async function playPage (page: VideoItem) {
  let { data } = await axios.get('/api/request-playurl', { params: { bvid: page.bvid, cid: page.cid } })

  currentItem.value = page
  currentPage.value = data

  const dash = currentPage.value?.dash
  if (dash) {
    let video = dash.video.filter(v => v.codecid === perferCodec.value)

    if (video.length === 0) {
      video = dash.video.filter(v => v.codecid === 7)
      currentCodec.value = 7
    } else {
      currentCodec.value = perferCodec.value
    }

    dash.video = video

    for (let v of video) {
      const newUrl = `/api/stream?url=${encodeURIComponent(v.baseUrl)}`
      v.baseUrl = newUrl
      v.base_url = newUrl
    }

    for (let a of dash.audio) {
      const newUrl = `/api/stream?url=${encodeURIComponent(a.baseUrl)}`
      a.baseUrl = newUrl
      a.base_url = newUrl
    }
  }

  player.attachSource(dash)
  player.setABRStrategy('abrDynamic')
  player.setFastSwitchEnabled(!0)
  player.enableLastBitrateCaching(!0)
  player.setBufferPruningInterval(20)
  player.setJumpGaps(!0)
}

function updateVideoState () {
  if (player) {

  }
}

function updateVideoStateLoop () {
  if (isRunning) {
    updateVideoState()
    setTimeout(updateVideoStateLoop, 1000)
  }
}

updateVideoStateLoop()

watch(perferCodec, (newValue) => {
  localStorage.setItem('BILIBILI_PLAYER_PERFER_CODEC', newValue.toString())
})

onMounted(() => {
  const videoElv = videoEl.value
  if (videoElv) {
    player = dashjs.MediaPlayer().create()
    player.initialize(videoEl.value)

    videoElv.addEventListener('resize', () => {
      statics.resolution = `${videoElv.videoWidth} x ${videoElv.videoHeight}`
    })
  }
})

onBeforeUnmount(() => {
  isRunning = false
})

function wait (ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}
</script>

<style scoped>
.page-item {
  padding: 0.5em;
  border: 2px solid #007AFF;
  margin-left: 1em;
  cursor: pointer;
  display: inline-block;
}
.page-item.selected {
  border: 2px solid #d8719c;
}
.format-item {
  padding: 0.2em;
  border: 1px solid #F9C6B0;
  margin-left: 1em;
  display: inline-block;
}
video {
  width: 40vw;
}
</style>
