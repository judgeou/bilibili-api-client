<template>
  <div>
    <div>
      <input type="file" ref="fileEl" @change="fileChange" />
      <button @click="destroyVideo">停止播放</button>
    </div>
    <div>
      选择弹幕：<select v-if="dandanMatches.length > 0" v-model="dandanMatchesSelected">
        <option v-for="m in dandanMatches" :key="m.episodeId" :value="m.episodeId">{{ `${m.animeTitle} - ${m.episodeTitle}` }}</option>
      </select>
    </div>
    <div v-if="videoSrc" ref="videoContainer" style="width: 50vw; height: 50vh; position: relative;">
      <video style="width: 50vw; height: 50vh; position: absolute;" ref="videoEl" :src="videoSrc" controls></video>
    </div>
  </div>
</template>

<script setup lang="ts">
import '../../global.d.ts'
import { ref, onMounted, nextTick, watch } from 'vue'
import sparkMd5 from 'spark-md5'
import axios from 'axios'
import Danmaku from 'danmaku'

interface DanDanMatch {
    animeId: number,
    animeTitle: string,
    episodeId: number,
    episodeTitle: string,
}

interface MatchResponse {
  errorCode: number,
  errorMessage: string,
  isMatched: boolean,
  matches: DanDanMatch[]
}

interface CommentsResponse {
  count: number,
  comments: {
    cid: number,
    m: string,
    p: string
  }[]
}

const videoEl = ref<HTMLVideoElement>()
const videoContainer = ref<HTMLDivElement>()
const fileEl = ref<HTMLInputElement>()

const videoSrc = ref('')
const matchInfo = ref({
  fileName: '',
  fileHash: '',
  fileSize: 0,
  videoDuration: 0,
  matchMode: 'hashAndFileName'
})
const dandanMatches = ref<DanDanMatch[]>([])
const dandanMatchesSelected = ref(-1)
let danmaku: Danmaku

watch(dandanMatchesSelected, (newVal) => {
  if (newVal > 0) {
    loadDanmaku(newVal)
  }
})

function getFileHash (file: File) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsArrayBuffer(file.slice(0, 16 * 1024 * 1024))
    reader.onload = (e) => {
      const md5 = new sparkMd5.ArrayBuffer()
      md5.append(e.target!.result)

      resolve(md5.end())
    }
  })
}

async function getVideoMatchInfo (file: File, videoEl: HTMLVideoElement): Promise<any> {
  const fileHash = await getFileHash(file)
  
  return {
    fileName: file.name,
    fileHash: fileHash,
    fileSize: file.size,
    videoDuration: videoEl.duration,
    matchMode: 'hashAndFileName'
  }
}

async function loadDanmakuList () {
  const { data } = await axios.post('/dandan-api/match', matchInfo.value)
  const { errorCode, errorMessage, isMatched, matches } = data as MatchResponse
  if (errorCode === 0 && matches.length > 0) {
    dandanMatches.value = matches
    if (matches.length > 0) {
      dandanMatchesSelected.value = matches[0].episodeId
    }
  }
}

async function loadDanmaku (episodeId: number) {
  const res2 = await axios.get(`/dandan-api/comment/${episodeId}`, { params: { withRelated: true }})
  const commentsResult = res2.data as CommentsResponse

  const defaultStyle = {
    fontSize: '20px',
    color: '#ffffff',
    textShadow: '-1px -1px #000, -1px 1px #000, 1px -1px #000, 1px 1px #000'
  }
  const comments = commentsResult.comments.slice(0, 5000).map(c => {
    const [ time ] = c.p.split(',')
    return {
      text: c.m,
      mode: 'rtl',
      time: Number(time),
      style: defaultStyle
    }
  })

  if (danmaku) {
    danmaku.destroy()
  }

  danmaku = new Danmaku({
    container: videoContainer.value!,
    media: videoEl.value!,
    comments: comments as any,
  })
}

async function fileChange () {
  const ext = 'mp4'
  const fileElv = fileEl.value

  if (fileElv) {
    if (fileElv.files && fileElv.files.length > 0) {
      const file = fileElv.files[0]

      videoSrc.value = URL.createObjectURL(file)

      await nextTick()
      const videoElv = videoEl.value

      videoElv!.oncanplay = async () => {
        videoElv!.oncanplay = null

        matchInfo.value = await getVideoMatchInfo(file, videoElv!)
        loadDanmakuList()

        videoElv!.volume = 0.5
        videoElv!.play()
      }
    }
  }
}

async function destroyVideo () {
  if (videoSrc.value) {
    URL.revokeObjectURL(videoSrc.value)
    videoSrc.value = ''
    fileEl.value!.value = null as any
  }
}

</script>

<style scoped>

</style>
