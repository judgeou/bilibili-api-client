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
    <h2 v-if="videoList.title">{{ videoList.title }}</h2>

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
import { VideoInfo, VideoItem, PlayurlData, DanmakuElem, NavResponse, getLoginUrlResponse, getLoginInfoResponse } from '../../../bilibili-api-type'

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
const videoSize = ref({
  width: 0,
  height: 0
})

let currentItem = ref<VideoItem>()
let currentPage = ref<PlayurlData>()
let perferCodec = ref(Number(perferCodecLocal))
let currentCodec = ref(0)
let useProxy = ref(false)
let proxyUrl = ref(localStorage.getItem('BILIBILI_PLAYER_PROXY_URL') || '')
let danmakuCount = ref(0)
let player: any
let isRunning = true
let danmaku: Danmaku
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
const videoContainerSize = computed(() => {
  const width = 576
  const ratio = videoSize.value.width > 0 ? videoSize.value.height / videoSize.value.width : 9 / 16
  return {
    width,
    height: width * ratio
  }
})

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
    proxyUrl: proxyUrl.value
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

    dash.video = video

    for (let v of video) {
      const newUrl = `/api/stream?url=${encodeURIComponent(v.baseUrl)}`
      v.baseUrl = newUrl
      v.base_url = newUrl

      v.backup_url = v.backupUrl = v.backupUrl.map(item => `/api/stream?url=${encodeURIComponent(item)}`)
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

  loadDanmaku()
}

function initDanmaku () {
  const defaultStyle = {
    'font-family': 'SimHei, Arial, Helvetica, sans-serif',
    fontSize: '30px',
    color: '#ffffff',
    textShadow: '-1px -1px #000, -1px 1px #000, 1px -1px #000, 1px 1px #000',
    'font-weight': 'normal'
  }
  danmaku = new Danmaku({
    container: videoContainer.value!,
    media: videoEl.value!,
    comments: [
      {
        text: '弹幕',
        mode: 'rtl',
        time: 1,
        style: defaultStyle
      }
    ]
  })
}

async function loadDanmaku () {
  const defaultStyle = {
    'font-family': 'SimHei, Arial, Helvetica, sans-serif',
    fontSize: '30px',
    color: '#ffffff',
    textShadow: '-1px -1px #000, -1px 1px #000, 1px -1px #000, 1px 1px #000',
    'font-weight': 'normal'
  }

  function toColor (num: number) {
    return '#' + num.toString(16)
  }

  const cid = currentItem.value!.cid
  danmakuCount.value = 0

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

function toggleFullscreen () {
  try { 
    videoContainer.value!.requestFullscreen()
  } catch {
    (videoContainer.value! as any).webkitRequestFullscreen()
  }
}

function resizeContainer () {
  danmaku.resize()
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

onMounted(async () => {
  {
    const res = await axios.get('/api/nav')
    navInfo.value = res.data
  }
  const videoElv = videoEl.value
  if (videoElv) {
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
  width: 50vw;
  height: 65vh;
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
</style>
