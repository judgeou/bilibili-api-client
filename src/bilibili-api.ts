import { AxiosInstance } from 'axios'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as open from 'open'
import * as stream from 'stream'
import * as util from 'util'
import * as inquirer from 'inquirer'
import { printOneLine, wait } from './toolkit'

const pipeline = util.promisify(stream.pipeline);

interface getLoginUrlResponse {
  code: number,
  data: {
    url: string,
    oauthKey: string,
  }
}

interface getLoginInfoResponse {
  message: string,
  status: boolean,
  data: number | {}
}

interface NavResponse {
  code: number,
  message: string,
  data: {
    isLogin: boolean,
    face: string,
    level_info: {
      current_level: number,
      current_min: number,
      current_exp: number,
      next_exp: number,
    },
    money: number,
    uname: string
  }
}

interface ViewResponse {
  code: number,
  message: string,
  data: {
    bvid: string,
    aid: number,
    videos: number,
    title: string,
    pages: {
      cid: number
    }[]
  }
}

interface DurlData {
  order: number,
  url: string,
  size: number,
}

interface DashData {
  video: {
    id: number, // Quality
    baseUrl: string,
    codecid: number, // CODECID
    codecs: string,
  }[],
  audio: {
    bandwidth: number,
    id: number, // Quality
    baseUrl: string,
    codecid: number, // CODECID
    codecs: string,
  }[]
}

interface PlayurlData {
  quality: number,
  format: string,
  accept_format: string,
  accept_description: string[],
  accept_quality: number[],
  durl: DurlData[],
  dash: DashData,
  support_formats: {
    codecs: string[],
    quality: number,
    new_description: string
  }[]
}

interface PlayurlResponse {
  code: number,
  message: string,
  data: PlayurlData
}

const CODECID_AVC = 7
const CODECID_HEVC = 12
const CODECID_AV1 = 13

const api_getLoginUrl = 'https://passport.bilibili.com/qrcode/getLoginUrl'
const api_getLoginInfo = 'https://passport.bilibili.com/qrcode/getLoginInfo'
const api_nav = 'https://api.bilibili.com/nav'
const api_view = 'https://api.bilibili.com/x/web-interface/view'
const api_playurl = 'https://api.bilibili.com/x/player/playurl'

async function request_nav (api: AxiosInstance) {
  const res1 = await api.get(api_nav)
  const data2 = res1.data as NavResponse

  if (data2.code === 0) {
    return data2
  } else {
    throw data2
  }
}

async function request_view (api: AxiosInstance, param: { bvid?: string, aid?: string }) {
  const res1 = await api.get(api_view, { params: param })
  const data1 = res1.data as ViewResponse

  if (data1.code === 0) {
    return data1.data
  } else {
    throw Error(data1.message)
  }
}

async function request_playurl (api: AxiosInstance, param: {
  bvid?: string,
  avid?: string,
  cid: number,
  qn?: number,
  fnval?: number
}) {
  const params = Object.assign({ qn: 32, fnval: 0, fnver: 0, fourk: 1 }, param)
  const res1 = await api.get(api_playurl, { params })
  const data1 = res1.data as PlayurlResponse

  if (data1.code === 0) {
    return data1.data
  } else {
    throw Error(data1.message)
  }
}

async function downloadVideo (api: AxiosInstance, playurlInfo: PlayurlData, filename: string) {
  const { durl, dash } = playurlInfo
  
  if (dash) {
    return downloadVideoDash(api, dash, filename, playurlInfo.quality)
  } else if (durl) {
    return downloadVideoDurl(api, durl, filename)
  } else {
    throw Error('没有可以下载的内容')
  }
}

async function downloadVideoDash (api: AxiosInstance, dash: DashData, filename: string, quality: number) {
  const { video, audio } = dash

  // get target quality videos
  let videos = video.filter(item => item.id === quality)

  // which codecs we can choose
  const codecsSet = Array.from(new Set(videos.map(item => item.codecs)))

  // ask user to choose codecs
  const codec = (await inquirer.prompt({
    type: 'rawlist',
    name: 'codec',
    message: '请选择视频编码',
    choices: codecsSet
  })).codec

  videos = videos.filter(item => item.codecs === codec)
  
  // get best quality audio
  const bestAudio = audio[0]

  const downloadVideosFilepath: string[] = []
  const downloadAudiosFilepath: string[] = []

  const downloadVideoItems = videos.map((item, index) => {
    return {
      index,
      codec,
      type: 'video',
      url: item.baseUrl,
      ext: 'm4s'
    }
  })
  const downloadAudioItems = {
    index: 0,
    codec: bestAudio.codecs,
    type: 'audio',
    url: bestAudio.baseUrl,
    ext: 'm4s'
  }
  const downloadItems = [...downloadVideoItems, downloadAudioItems]

  for (const item of downloadItems) {
    const filepath = path.resolve('./download', `${filename.replace(/\//g, '_')}_${item.type}_${item.index}_${item.codec}.${item.ext}`)
    await fs.remove(filepath)
    fs.closeSync(fs.openSync(filepath, 'w'));

    const url = item.url
    const res1 = await api.get(url, { responseType: 'stream', })
    const size = Number(res1.headers['content-length'])
    const writer = fs.createWriteStream(filepath, { flags: 'a' })

    let state = -1
    pipeline(res1.data, writer).then(() => {
      state = 0
    }).catch(err => {
      state = err
    })

    for (let written = 0; state === -1;) {
      const stat = await fs.stat(filepath)
      const writtenPerSecond = (stat.size - written)
      written = stat.size

      printOneLine(`${(written / size * 100).toFixed(2)}% ${(writtenPerSecond / 1024 / 1024).toFixed(2)} MB/S \r`)

      await wait(1000)
    }

    if (item.type === 'video') {
      downloadVideosFilepath.push(filepath)
    } else if (item.type === 'audio') {
      downloadAudiosFilepath.push(filepath)
    }
  }

  console.log(downloadVideosFilepath, downloadAudiosFilepath)
}

async function downloadVideoDurl (api: AxiosInstance, durl: DurlData[], filename: string) {
  for (const { url, order, size } of durl) {
    const filepath = path.resolve('./download', `${filename.replace(/\//g, '_')}_${order}.flv`)
    await fs.remove(filepath)
    fs.closeSync(fs.openSync(filepath, 'w'));
    
    const res1 = await api.get(url, { responseType: 'stream', })
    const writer = fs.createWriteStream(filepath, { flags: 'a' })

    let state = -1
    pipeline(res1.data, writer).then(() => {
      state = 0
    }).catch(err => {
      state = err
    })

    for (let written = 0; written < size && state === -1;) {
      const stat = await fs.stat(filepath)
      const writtenPerSecond = (stat.size - written)
      written = stat.size

      printOneLine(`${(written / size * 100).toFixed(2)}% ${(writtenPerSecond / 1024 / 1024).toFixed(2)} MB/S \r`)

      await wait(1000)
    }

    return state
  }
}

export {
  getLoginUrlResponse,
  getLoginInfoResponse,
  NavResponse,

  api_getLoginUrl,
  api_getLoginInfo,
  api_nav,
  api_view,

  request_nav,
  request_view,
  request_playurl,

  downloadVideo
}