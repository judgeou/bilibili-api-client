<template>
  <div>
    <div>
      <input type="file" ref="fileEl" @change="fileChange" /> <button @click="destroyVideo">停止播放</button>
    </div>
    <div ref="videoContainer" style="width: 50vw; height: 50vh; position: relative;">
      <video v-if="videoSrc" style="width: 50vw; height: 50vh; position: absolute;" ref="videoEl" :src="videoSrc" controls></video>
    </div>
  </div>
</template>

<script setup lang="ts">
import '../../global.d.ts'
import { ref, onMounted, nextTick } from 'vue'
import sparkMd5 from 'spark-md5'
import axios from 'axios'
import Danmaku from 'danmaku'

interface matchResponse {
  errorCode: number,
  errorMessage: string,
  isMatched: boolean,
  matches: {
    animeId: number,
    animeTitle: string,
    episodeId: number,
    episodeTitle: string,
  }[]
}

interface commentsResponse {
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
let danmaku: Danmaku

function getVideoMatchInfo (file: File, videoEl: HTMLVideoElement): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsArrayBuffer(file.slice(0, 16 * 1024 * 1024))
    reader.onload = (e) => {
      const md5 = new sparkMd5.ArrayBuffer()
      md5.append(e.target!.result)

      resolve({
        fileName: file.name,
        fileHash: md5.end(),
        fileSize: file.size,
        videoDuration: videoEl.duration,
        matchMode: 'hashAndFileName'
      })
    }
  })
}

async function loadDanmaku () {
  const { data } = await axios.post('/dandan-api/match', matchInfo.value)
  const { errorCode, errorMessage, isMatched, matches } = data as matchResponse
  if (errorCode === 0 && matches.length > 0) {
    const [ m ] = matches
    
    const res2 = await axios.get(`/dandan-api/comment/${m.episodeId}`, { params: { withRelated: true }})
    const commentsResult = res2.data as commentsResponse

    const defaultStyle = {
      fontSize: '20px',
      color: '#ffffff',
      textShadow: '-1px -1px #000, -1px 1px #000, 1px -1px #000, 1px 1px #000'
    }
    const comments = commentsResult.comments.map(c => {
      const [ time ] = c.p.split(',')
      return {
        text: c.m,
        mode: 'rtl',
        time: Number(time),
        style: defaultStyle
      }
    })

    danmaku = new Danmaku({
      container: videoContainer.value!,
      media: videoEl.value!,
      comments: comments as any,
    })
  }
}

async function fileChange () {
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
        loadDanmaku()

        videoElv!.volume = 0.5
        // videoElv!.play()
      }
    }
  }
}

async function destroyVideo () {
  if (videoSrc.value) {
    URL.revokeObjectURL(videoSrc.value)
    videoSrc.value = ''
  }
}

</script>

<style scoped>

</style>
