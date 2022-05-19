import { AxiosInstance } from 'axios'
import * as http from 'http'
import { AddressInfo } from 'net'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as open from 'open'
import * as stream from 'stream'
import * as util from 'util'
import * as inquirer from 'inquirer'
import { mergeMedia, playMedia, printOneLine, wait, questionAsync, isFFMPEGInstalled, formatDate, printDownloadInfoLoop } from './toolkit'
import { resolve } from 'path'

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
      cid: number,
      part: string,
      page: number
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

interface SeasonData {
  season_title: string,
  evaluate: string,
  episodes: {
    bvid: string,
    cid: number,
    long_title: string,
  }[]
}

interface SeasonResponse {
  code: number,
  message: string,
  result: SeasonData
}

interface RoomInitResponse {
  code: number,
  message: string,
  data: {
    room_id: number,
  }
}

interface RoomPlayurlResponse {
  code: number,
  message: string,
  data: {
    current_quality: number,
    current_qn: number,
    accept_quality: number[],
    quality_description: {
      qn: number,
      desc: string
    }[],
    durl: {
      url: string
    }[]
  }
}

interface VideoItem {
  bvid: string,
  cid: number,
  title: string,
  page: number
}

interface VideoInfo {
  title: string
  list: VideoItem[]
}

const CODECID_AVC = 7
const CODECID_HEVC = 12
const CODECID_AV1 = 13

const CODEC_MAP = {
  [CODECID_AVC]: 'avc',
  [CODECID_HEVC]: 'hevc',
  [CODECID_AV1]: 'av1'
}

const api_getLoginUrl = 'https://passport.bilibili.com/qrcode/getLoginUrl'
const api_getLoginInfo = 'https://passport.bilibili.com/qrcode/getLoginInfo'
const api_nav = 'https://api.bilibili.com/nav'
const api_view = 'https://api.bilibili.com/x/web-interface/view'
const api_playurl = 'https://api.bilibili.com/x/player/playurl'
const api_season = 'https://api.bilibili.com/pgc/view/web/season'
const api_room_init = 'https://api.live.bilibili.com/room/v1/Room/room_init'
const api_room_playurl = 'https://api.live.bilibili.com/room/v1/Room/playUrl'

function isbvid (str: string) {
  return /^BV\w{10}$/.test(str)
}

function bilibiliUrlToBvid (url: string) {
  const match = url.match(/www.bilibili.com\/video\/(BV\w+)/)
  
  if (match?.length > 1) {
    return match[1]
  } else {
    return null
  }
}

function bilibiliUrlToEpid (url: string) {
  const match = url.match(/www.bilibili.com\/bangumi\/play\/ep(\d+)/)

  if (match?.length > 1) {
    return match[1]
  } else {
    return null
  }
}

function bilibiliUrlToLiveid (url: string) {
  const match = url.match(/live.bilibili.com\/(\d+)/)

  if (match?.length > 1) {
    return match[1]
  } else {
    return null
  }
}

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
  const params = Object.assign({ qn: 112, fnval: 0, fnver: 0, fourk: 1 }, param)
  const res1 = await api.get(api_playurl, { params })
  const data1 = res1.data as PlayurlResponse

  if (data1.code === 0) {
    return data1.data
  } else {
    throw Error(data1.message)
  }
}

async function request_season (api: AxiosInstance, params: { ep_id: number }) {
  const res1 = await api.get(api_season, { params })
  const data1 = res1.data as SeasonResponse

  if (data1.code === 0) {
    return data1.result
  } else {
    throw Error(data1.message)
  }
}

async function request_room_init (api: AxiosInstance, params: { id: number }) {
  const res1 = await api.get(api_room_init, { params })
  const data1 = res1.data as RoomInitResponse

  if (data1.code === 0) {
    return data1.data
  } else {
    throw Error(data1.message)
  }
}

async function request_room_playurl (api: AxiosInstance, params: { cid: number, platform: string, qn: number }) {
  const res1 = await api.get(api_room_playurl, { params })
  const data1 = res1.data as RoomPlayurlResponse

  if (data1.code === 0) {
    return data1.data
  } else {
    throw Error(data1.message)
  }
}

async function downloadLive (api: AxiosInstance, url: string) {
  const liveid = bilibiliUrlToLiveid(url)

  if (liveid) {
    const id = Number(bilibiliUrlToLiveid(url))

    const res1 = await request_room_init(api, { id })
    const roomid = res1.room_id

    let res2 = await request_room_playurl(api, { cid: roomid, platform: 'h5', qn: 10000 })
    const { qn } = await inquirer.prompt({
      type: 'rawlist',
      name: 'qn',
      message: '请选择下载的视频质量',
      choices: res2.quality_description.map(item => {
        return {
          name: item.desc,
          value: item.qn
        }
      })
    })

    if (qn !== res2.current_qn) {
      res2 = await request_room_playurl(api, { cid: roomid, platform: 'h5', qn })
    }

    const downloadUrl = res2.durl[0].url
    const outputFilepath = path.resolve('./download', `live_${id}_${formatDate(new Date())}.mkv`)
    
    console.log('开始保存直播视频，位置: ' + outputFilepath)
    console.log('如果要停止则直接按 Ctrl+C')

    let state = { exit: false }
    printDownloadInfoLoop(outputFilepath, state)

    await mergeMedia([ downloadUrl ], outputFilepath)
    state.exit = true

    return true
  } else {
    return false
  }
}

async function getVideoList (api: AxiosInstance, url: string) : Promise<VideoInfo> {
  let bvid: string
  let epid: number
  let result: VideoInfo = {
    title: '',
    list: []
  }

  if (isbvid(url)) {
    bvid = url
  } else {
    bvid = bilibiliUrlToBvid(url)

    if (bvid === null) {
      epid = Number(bilibiliUrlToEpid(url))

      if (epid) {
        const seasonData = await request_season(api, { ep_id: epid })
        const { episodes } = seasonData
        result.title = seasonData.season_title

        if (episodes.length > 1) {
          const { pageIndex } = await inquirer.prompt({
            type: 'rawlist',
            name: 'pageIndex',
            message: '请选择需要下载的剧集: ',
            choices: [
              {
                name: '【下载全集】',
                value: 0
              },
              ...episodes.map((item, index) => {
                return {
                  name: item.long_title,
                  value: index + 1
                }
              })
            ]
          })

          if (pageIndex === 0) {
            result.list = episodes.map((item, index) => {
              return {
                bvid: item.bvid,
                cid: item.cid,
                title: item.long_title,
                page: index + 1
              }
            })
          } else {
            const ep = episodes[pageIndex - 1]
            result.list = [{
              bvid: ep.bvid,
              cid: ep.cid,
              title: ep.long_title,
              page: pageIndex
            }]
          }
        } else {
          result.list.push({
            bvid: episodes[0].bvid,
            cid: episodes[0].cid,
            title: episodes[0].long_title,
            page: 1
          })
        }
      } else {
        throw Error('无效的视频链接')
      }
    }
  }

  if (bvid) {
    const viewInfo = await request_view(api, { bvid })
    const { pages } = viewInfo

    result.title = viewInfo.title

    if (pages.length > 1) {
      const { pageIndex } = await inquirer.prompt({
        type: 'rawlist',
        name: 'pageIndex',
        message: '请选择需要下载的分P: ',
        choices: [
          {
            name: '【下载全部分P】',
            value: 0
          },
          ...pages.map(page => {
          return {
            name: `${page.part}`,
            value: page.page
          }
        })]
      })
      
      if (pageIndex === 0) {
        result.list = pages.map(page => {
          return {
            bvid: viewInfo.bvid,
            cid: page.cid,
            title: page.part,
            page: page.page
          }
        })
      } else {
        const page = pages.find(page => page.page === pageIndex)
        result.list = [{
          bvid: viewInfo.bvid,
          cid: page.cid,
          title: page.part,
          page: page.page
        }]
      }

    } else if (pages.length === 1) {
      result.list = [{
        bvid: viewInfo.bvid,
        cid: pages[0].cid,
        title: viewInfo.title,
        page: 1
      }]
    }
  }

  return result
}

async function downloadVideo (api: AxiosInstance, playurlInfo: PlayurlData, filename: string, codecid: number) {
  const { durl, dash } = playurlInfo
  
  if (dash) {
    return downloadVideoDash(api, dash, filename, playurlInfo.quality, codecid)
  } else if (durl) {
    return downloadVideoDurl(api, durl, filename)
  } else {
    throw Error('没有可以下载的内容')
  }
}

async function downloadVideoDash (api: AxiosInstance, dash: DashData, filename: string, quality: number, codecid: number) {
  const { video, audio } = dash

  // get target quality videos
  let videos = video.filter(item => item.id === quality)

  videos = videos.filter(item => item.codecid === codecid)

  if (videos.length === 0) {
    videos = [ video.filter(item => item.id === quality)[0] ]

    console.log(`该视频没有对应的编码，尝试更换为 ${CODEC_MAP[videos[0].codecid]}`)
  }
  
  // get best quality audio
  const bestAudio = audio[0]

  const downloadVideoItems = videos.map((item, index) => {
    return {
      index,
      codec: item.codecs,
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

  const responses = await Promise.all(downloadItems.map(async item => {
    const url = item.url
    const res1 = await api.get(url, { responseType: 'stream', })
    return res1
  }))

  const server = http.createServer((req, res) => {
    const index = Number(req.url[1]) // /1 -> 1; /2 -> 2
    pipeline(responses[index].data, res)
  })

  const addressInfo = await new Promise<AddressInfo>(resolve => {
    server.listen(0, () => {
      const addressInfo = server.address() as AddressInfo
      resolve(addressInfo)
    })
  })

  const outputFilepath = path.resolve('./download', `${filename.replace(/\//g, '_')}_${videos[0].codecs}.mkv`)

  const totalSize = responses.reduce((total, item) => total + Number(item.headers['content-length']), 0)
  let state = { exit: false }
  printDownloadInfoLoop(outputFilepath, state, totalSize)

  await mergeMedia(downloadItems.map((item, index) => {
    const url = `http://localhost:${addressInfo.port}/${index}`
    return url
  }), outputFilepath)

  state.exit = true

  return outputFilepath
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

    return filepath
  }
}

async function getFnval () {
  const isFFMPEGinstalled = await isFFMPEGInstalled()
  let fnval: number
  
  if (isFFMPEGinstalled) {
    const answerNewType = await inquirer.prompt({
      type: 'confirm',
      name: 'newType',
      message: 'ffmpeg 已安装，是否使用新型下载方式?（支持 hevc，av1 编码），下载速度更快'
    })
    fnval = answerNewType.newType ? 4048 : 0
  } else {
    console.log('ffmpeg 未安装，使用普通下载方式')
    fnval = 0
  }

  return fnval
}

async function askCodecId () {
  const answer = await inquirer.prompt({
    type: 'rawlist',
    name: 'codecid',
    message: '请选择视频编码',
    choices: [
      {
        name: 'avc',
        value: CODECID_AVC
      },
      {
        name: 'hevc',
        value: CODECID_HEVC
      },
      {
        name: 'av1',
        value: CODECID_AV1
      }
    ]
  })

  return answer.codecid as number
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

  downloadLive,
  downloadVideo,
  isbvid,
  bilibiliUrlToBvid,
  bilibiliUrlToEpid,
  getVideoList,
  getFnval,
  askCodecId
}