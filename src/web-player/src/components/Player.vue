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
      {{ statics }}
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
import { ref, reactive, nextTick, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { VideoInfo, VideoItem, PlayurlData } from '../../../bilibili-api-type'

const inputUrl = ref('https://www.bilibili.com/video/BV1qM4y1w716')

let videoList = ref({
  title: '无标题',
  list: []
} as VideoInfo)

let videoEl = ref<HTMLVideoElement>()
let currentItem = ref<VideoItem>()
let currentPage = ref<PlayurlData>()
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
}

async function playPage (page: VideoItem) {
  let { data } = await axios.get('/api/request-playurl', { params: { bvid: page.bvid, cid: page.cid } })

  currentItem.value = page
  currentPage.value = data

  const dash = currentPage.value?.dash
  if (dash) {
    dash.video = dash.video.filter(v => v.codecid === 7)
    for (let v of dash.video) {
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

  player.initialize(videoEl.value, dash, false, false, undefined)

  // player.attachSource(`/api/request-mpd?bvid=${page.bvid}&cid=${page.cid}`)

  // player.updateSettings({
  //     streaming: {
  //         buffer: {
  //             fastSwitchEnabled: true
  //         }
  //     }
  // });

  // player.on(dashjs.MediaPlayer.events.PLAYBACK_TIME_UPDATED, () => {
  //   const activeStream = player.getActiveStream()
  //   const streamInfo = activeStream.getStreamInfo();
  //   const dashMetrics = player.getDashMetrics();
  //   const dashAdapter = player.getDashAdapter();

  //   if (dashMetrics && streamInfo) {
  //     const periodIdx = streamInfo.index;
  //     var repSwitch = dashMetrics.getCurrentRepresentationSwitch('video', true);
  //     var bufferLevel = dashMetrics.getCurrentBufferLevel('video', true);
  //     var bitrate = repSwitch ? Math.round(dashAdapter.getBandwidthForRepresentation(repSwitch.to, periodIdx) / 1000) : NaN;
  //     var adaptation = dashAdapter.getAdaptationForType(periodIdx, 'video', streamInfo);
  //     var currentRep = adaptation.Representation_asArray.find(function (rep: any) {
  //         return rep.id === repSwitch.to
  //     })
  //     var frameRate = currentRep.frameRate;
  //     var resolution = currentRep.width + 'x' + currentRep.height;
  //     statics.bufferLevel = bufferLevel + " secs";
  //     statics.framerate = frameRate + " fps";
  //     statics.reportedBitrate = bitrate + " Kbps";
  //     statics.resolution = resolution;
  //     statics.codecs = currentRep.codecs
  //   }
  // })
}

onMounted(() => {
  const videoElv = videoEl.value
  if (videoElv) {
    window.player = player = dashjs.MediaPlayer().create()
  }
})

onBeforeUnmount(() => {
  isRunning = false
  player.reset()
})

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
