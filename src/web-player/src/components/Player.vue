<template>
  <div>
    <div v-if="loginUrlInfo && navInfo?.data?.isLogin === false">
      {{ scanMsg }}
      <br>
      <img v-if="qrcodeBase64" :src="qrcodeBase64" />
    </div>

    <div v-if="navInfo?.data?.isLogin">
      <b>{{ navInfo!.data!.uname }}</b>
      <span v-if="navInfo!.data!.vipType === 1" style="color: red;">(大会员)</span>
      <span v-if="navInfo!.data!.vipType === 2" style="color: red;">(年度大会员)</span>
    </div>

    <button v-if="navInfo?.code !== 0" @click="doLogin">登陆</button>
    输入哔哩哔哩网址：<input type="text" style="width: 30em;" v-model="inputUrl"> <button @click="playUrl">播放</button>
    <label> <input type="checkbox" v-model="useProxy" /> 使用代理 </label>
    <input type="text" v-if="useProxy" placeholder="填写代理地址" v-model="proxyUrl" />
    <label><input type="checkbox" v-model="isReplaceCDN" />强制替换为国内CDN</label>

    <h2 v-if="videoList.title">{{ videoList.title }}</h2>

    <div>
      视频编码：
      <select v-model="perferCodec">
        <option :value="7">avc</option>
        <option :value="12">hevc</option>
        <option :value="13">av1</option>
      </select>

      <span v-if="currentCodec > 0" style="margin-left: 1em;">实际编码：{{ CODEC_MAP[currentCodec] }}</span>

      <label><input type="checkbox" v-model="isBestQuality" /> 强制最高分辨率</label>
    </div>

    <div>
      <button @click="loadDanmaku">重载弹幕</button>
      弹幕占屏: 
      <select v-model="danmakuOccupied">
        <option>0%</option>
        <option>25%</option>
        <option>50%</option>
        <option>75%</option>
        <option>100%</option>
      </select>
      分辨率：{{ statics.resolution }} 弹幕数量：{{ danmakuCount }}
    </div>

    <div>
      <button @click="toggleFullscreen">全屏</button>
    </div>

    <div class="row">
      <div ref="videoContainer" class="video-container" @fullscreenchange="resizeContainer" @webkitfullscreenchange="resizeContainer">
        <video ref="videoEl" autoplay preload="none" controls="true"
          @resize="videoResize">
        </video>

        <div ref="danmakuContainer" class="danmaku-container" :style="{ height: danmakuOccupied }"></div>
        <div ref="subtitleContainer" class="subtitle-container"></div>
      </div>

      <div class="page-list row row-column">
        <div v-for="page in videoList.list" @click="playPage(page)" class="page-item" :class="{ 'selected': currentItem === page }">
          {{ `${page.page}. ${page.title}` }}
        </div>
      </div>
    </div>

  </div>
</template>

<script lang="ts">
declare var dashjs: any
</script>

<script lang="ts" setup>
import { ref, reactive, nextTick, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import axios from 'axios'
import Danmaku from 'danmaku'
// @ts-ignore
import * as QRCode from 'qrcode'
import { VideoInfo, VideoItem, PlayurlData, DanmakuElem, NavResponse, getLoginUrlResponse, SubtitleRaw } from '../../../bilibili-api-type'

const CODECID_AVC = 7
const CODECID_HEVC = 12
const CODECID_AV1 = 13

const CODEC_MAP = {
  [CODECID_AVC.toString()]: 'avc',
  [CODECID_HEVC.toString()]: 'hevc',
  [CODECID_AV1.toString()]: 'av1'
}

const inputUrl = ref('https://www.bilibili.com/bangumi/play/ss41492/')

let perferCodecLocal = localStorage.getItem('BILIBILI_PLAYER_PERFER_CODEC') || 7

/** DATA */
let videoList = ref({
  title: '',
  list: []
} as VideoInfo)

let videoEl = ref<HTMLVideoElement>()
const videoContainer = ref<HTMLDivElement>()
const danmakuContainer = ref<HTMLDivElement>()
const subtitleContainer = ref<HTMLDivElement>()
const videoSize = ref({
  width: 0,
  height: 0
})

let currentItem = ref<VideoItem>()
let currentPage = ref<PlayurlData>()
let perferCodec = ref(Number(perferCodecLocal))
let currentCodec = ref(0)
let isBestQuality = ref(false)
let useProxy = ref(false)
let proxyUrl = ref(localStorage.getItem('BILIBILI_PLAYER_PROXY_URL') || '')
let isReplaceCDN = ref(false)
let danmakuCount = ref(0)
let danmakuOccupied = ref('50%')
let player: any
let isRunning = true
let danmaku: Danmaku
let danmakuSub: Danmaku
let navInfo = ref<NavResponse>()
let loginUrlInfo = ref<getLoginUrlResponse>()
let qrcodeBase64 = ref('')
let scanMsg = ref('')

const statics = reactive({
  bufferLevel: '',
  framerate: '',
  reportedBitrate: '',
  resolution: '',
  codecs: ''
})

/** COMPUTED */

/* Methods */
async function wait (ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

async function doLogin () {
  const res1 = await axios.get('/api/get-login-url')
  const data1 = res1.data as getLoginUrlResponse
  loginUrlInfo.value = data1

  if (data1.code === 0) {
    const scanUrl = data1.data.url
    QRCode.toDataURL(scanUrl, (err: any, url: string) => {
      qrcodeBase64.value = url
    })

    for(let loginInfo: any;;) {
      const res2 = await axios.get('/api/get-login-info', { params: { oauthKey: data1.data.oauthKey } })
      loginInfo = res2.data

      console.log(loginInfo)

      if (loginInfo.data === -1 || loginInfo.data === -2) { // -1：密钥错误 -2：密钥超时
        return null
      } else if (loginInfo.data === -4) { // -4：未扫描 -5 未确认
        scanMsg.value = '请使用哔哩哔哩APP扫码登陆'
      } else if (loginInfo.data === -5) {
        scanMsg.value = '等待确认'
      } else { // obj: 成功
        const res = await axios.get('/api/nav')
        navInfo.value = res.data

        return
      }

      await wait(1000)
    }
  }
  
}

async function playUrl () {
  const url = inputUrl.value
  let { data } = await axios.get('/api/get-video-list', { params: {
    url,
    useProxy: useProxy.value,
    proxyUrl: proxyUrl.value
  } })

  if (data.error) {
    alert(data.error)
    return
  }

  videoList.value = data

  if (videoList.value.list.length === 1) {
    playPage(videoList.value.list[0])
  }

  // 保存代理地址到 localStorage
  if (useProxy.value) {
    localStorage.setItem('BILIBILI_PLAYER_PROXY_URL', proxyUrl.value)
  }
}

async function playPage (page: VideoItem) {
  let { data } = await axios.get('/api/request-playurl', { params: {
    bvid: page.bvid,
    cid: page.cid,
    useProxy: useProxy.value,
    proxyUrl: proxyUrl.value,
    isReplaceCDN: isReplaceCDN.value
  } })

  if (data.error) {
    alert(data.error)
    return
  }

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

    if (isBestQuality.value) {
      const bestWidth = Math.max(...video.map(v => v.width))
      video = video.filter(v => v.width === bestWidth)
    }

    dash.video = video

    for (let v of video) {
      const newUrl = `/api/stream?url=${encodeURIComponent(v.baseUrl)}` + (useProxy.value ? `&isReplaceHost=1` : '')
      v.baseUrl = newUrl
      v.base_url = newUrl

      v.backup_url = v.backupUrl = v.backupUrl.map(item => `/api/stream?url=${encodeURIComponent(item)}` + (useProxy.value ? `&isReplaceHost=1` : ''))
    }

    for (let a of dash.audio) {
      const newUrl = `/api/stream?url=${encodeURIComponent(a.baseUrl)}`
      a.baseUrl = newUrl
      a.base_url = newUrl

      a.backup_url = a.backupUrl = a.backupUrl.map(item => `/api/stream?url=${encodeURIComponent(item)}`)
    }
  }

  player.attachSource(dash)
  player.setABRStrategy('abrDynamic')
  player.setFastSwitchEnabled(!0)
  player.enableLastBitrateCaching(!0)
  player.setBufferPruningInterval(20)
  player.setJumpGaps(!0)

  loadSubtitle()
  loadDanmaku()
}

function initDanmaku () {
  danmaku = new Danmaku({
    container: danmakuContainer.value!,
    media: videoEl.value!,
    comments: []
  })

  danmakuSub = new Danmaku({
    container: subtitleContainer.value!,
    media: videoEl.value!,
    comments: []
  })
}

async function loadDanmaku () {
  const defaultStyle = {
    'font-family': 'SimHei, "Microsoft JhengHei", Arial, Helvetica, sans-serif',
    fontSize: '30px',
    color: '#ffffff',
    textShadow: 'rgb(0, 0, 0) 1px 0px 1px, rgb(0, 0, 0) 0px 1px 1px, rgb(0, 0, 0) 0px -1px 1px, rgb(0, 0, 0) -1px 0px 1px',
    'font-weight': 'normal'
  }

  function toColor (num: number) {
    return '#' + num.toString(16)
  }

  const cid = currentItem.value!.cid
  danmakuCount.value = 0
  danmaku.clear()

  for (let i = 1; ;i++) { 
    let res = await axios.get('/api/dm-seg', { params: {
      cid,
      segment_index: i
    }})

    const dms = res.data as DanmakuElem[]

    if (dms.length === 0) {
      break
    }

    dms.forEach(item => {
      let mode = 'rtl'
      if (item.mode === 4) {
        mode = 'bottom'
      } else if (item.mode === 5) {
        mode = 'top'
      }

      const color = toColor(item.color)

      danmaku.emit({
        text: item.content,
        mode: mode as any,
        time: item.progress / 1000,
        style: {...defaultStyle, color}
      })
    })

    danmakuCount.value += dms.length
  }
}

async function loadSubtitle () {
  const defaultStyle = {
    'background': 'rgba(0, 0, 0, 0.4)',
    'white-space': 'normal',
    'padding': '2px 12px 2px 8px',
    'border-radius': '2px',
    'line-height': '1.5',
    'word-wrap': 'break-word',
    'color': 'white'
  }

  const res1 = await axios.get('/api/subtitles', { params: { bvid: currentItem.value!.bvid, proxyUrl: proxyUrl.value, useProxy: useProxy.value }})
  const data1 = res1.data as SubtitleRaw[]

  danmakuSub.clear()

  if (data1.length > 0) {
    const sub = data1[0]

    for (let subItem of sub.data) {
      danmakuSub.emit({
        text: subItem.content,
        mode: 'bottom',
        time: subItem.from,
        style: defaultStyle
      })
    }
  }
}

function toggleFullscreen () {
  try { 
    videoContainer.value!.requestFullscreen()
  } catch {
    (videoContainer.value! as any).webkitRequestFullscreen()
  }
}

function resizeContainer () {
  setTimeout(() => {
    danmaku.resize()
  }, 1000)
}

async function videoResize (e: Event) {
  const videoElv = e.target as HTMLVideoElement
  if (videoElv) {
    videoSize.value = {
      width: videoElv.videoWidth,
      height: videoElv.videoHeight
    }
    statics.resolution = `${videoElv.videoWidth} x ${videoElv.videoHeight}`
  }
}

watch(perferCodec, (newValue) => {
  localStorage.setItem('BILIBILI_PLAYER_PERFER_CODEC', newValue.toString())
})

watch(danmakuOccupied, async () => {
  await nextTick()
  danmaku.resize()
})

onMounted(async () => {
  {
    const res = await axios.get('/api/nav')
    navInfo.value = res.data
  }
  const videoElv = videoEl.value
  if (videoElv) {
    videoElv.volume = 0.5
    player = dashjs.MediaPlayer().create()
    player.initialize(videoEl.value)

    initDanmaku()
  }
})

onBeforeUnmount(() => {
  isRunning = false
})

</script>

<style scoped>
.page-list {
  justify-content: space-between;
}
.page-item {
  padding: 0.5em;
  border: 2px solid gray;
  margin-left: 1em;
  cursor: pointer;
  display: inline-block;
}
.page-item:hover {
  border: 2px solid rgb(41, 90, 213);
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
.row {
  display: flex;
}
.row.row-column {
  flex-direction: column;
}
.video-container {
  width: 640px;
  height: 360px;
  position: relative;
}
.video-container:fullscreen {
  width: 100vw;
  height: 100vh;
}
.video-container:-webkit-full-screen {
  width: 100vw;
  height: 100vh;
}
.video-container video {
  width: 100%;
  height: auto;
  position: absolute;

  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.danmaku-container {
  position: absolute;
  width: 100%;
  height: 50%;
  top: 0;
  pointer-events: none;
}
.danmaku-container div {
  pointer-events: none;
}
.subtitle-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  pointer-events: none;
}
.subtitle-container div {
  pointer-events: none;
}
</style>
