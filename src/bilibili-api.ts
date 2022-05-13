import { AxiosInstance } from 'axios'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as open from 'open'

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

interface PlayurlData {
  quality: number,
  format: string,
  accept_format: string,
  accept_description: string[],
  accept_quality: number[],
  durl: {
    order: number,
    url: string,
    size: number,
  }[],
  support_formats: {
    quality: number,
    new_description: string
  }[]
}

interface PlayurlResponse {
  code: number,
  message: string,
  data: PlayurlData
}

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
    throw Error(data2.message)
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
  const params = { ...param, qn: 32, fnval: 0, fnver: 0, fourk: 1 }
  const res1 = await api.get(api_playurl, { params })
  const data1 = res1.data as PlayurlResponse

  if (data1.code === 0) {
    return data1.data
  } else {
    throw Error(data1.message)
  }
}

async function downloadVideo (api: AxiosInstance, playurlInfo: PlayurlData, filename: string) {
  return new Promise(async (resolve, reject) => {
    const { durl } = playurlInfo
  
    for (const { url, order, size } of durl) {
      const filepath = path.resolve('./download', `${filename.replace(/\//g, '_')}_${order}.flv`)
      await fs.remove(filepath)
      const writer = fs.createWriteStream(filepath, { flags: 'a' })
      
      writer.on('open', async () => {
        const res1 = await api.get(url, { responseType: 'stream', onDownloadProgress: progressEvent => {
          console.log(progressEvent)
        }})

        let written = 0
        let writtenPerSecond = 0
        let checkTime = new Date().getTime()
        let openedPlayer = false

        res1.data.on('data', chunk => {
          writer.write(chunk)
          written += chunk.length
          writtenPerSecond += chunk.length

          const now = new Date().getTime()

          if (now - checkTime > 1000) {
            checkTime = now
            process.stdout.write(`${(written / size * 100).toFixed(2)}% ${(writtenPerSecond / 1024 / 1024).toFixed(2)} MB/S \r`)
            writtenPerSecond = 0
          }

          if (openedPlayer === false && written > 1024 * 1024) {
            openedPlayer = true
            // open(filepath)
          }
        })

        res1.data.on('close', () => {
          writer.close()
          resolve(null)
        })
      })

      break
    }
  })
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