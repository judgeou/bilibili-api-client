import * as fs from 'fs-extra'
import * as readline from 'readline'
import axios, { AxiosInstance } from 'axios'
import * as QRCode from 'qrcode'
import { buildFormData, buildPostParam, questionAsync, showQRCodeConsole, showQRCodeFile, wait } from './toolkit'
import {
  getLoginInfoResponse, getLoginUrlResponse, NavResponse,
  api_getLoginUrl, api_getLoginInfo, api_nav, request_nav, request_view, request_playurl, downloadVideo
} from './bilibili-api'


const referer = "https://www.bilibili.com/"
const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.54 Safari/537.36 Edg/101.0.1210.39`
const acceptLanguage = 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6'

const cookieMap = new Map<string, string>()

const http = axios.create({
  headers: {
    referer,
    'user-agent': userAgent,
    'accept-language': acceptLanguage
  }
})

// set cookie
http.interceptors.response.use(res => {
  const set_cookie = res.headers['set-cookie']
  if (set_cookie?.length > 0) {
    for (const newCookie of set_cookie) {
      const cookie = newCookie.split(';')[0]
      const key = cookie.split('=')[0]
      const value = cookie.split('=')[1]
      cookieMap.set(key, value)
    }
  }

  return res
})

http.interceptors.request.use(config => {
  const cookieArray = []
  for (const [key, value] of cookieMap) {
    cookieArray.push(`${key}=${value}`)
  }
  const cookieStr = cookieArray.join('; ')
  config.headers.cookie = cookieStr
  return config
})

async function getAuthedApi () {
  try {
    await loadCookie()
    return http
  } catch (err) {
    console.log('读取cookie失败')
  }

  const res1 = await http.get(api_getLoginUrl)
  const data1 = res1.data as getLoginUrlResponse
  if (data1.code === 0) {
    await showQRCodeFile(data1.data.url)

    for (let data2: getLoginInfoResponse; ; ) {
      const res2 = await http.post(api_getLoginInfo, buildPostParam({
        oauthKey: data1.data.oauthKey
      }))
      data2 = res2.data

      if (data2.data === -1 || data2.data === -2) { // -1：密钥错误 -2：密钥超时
        console.log(data2.message)
        return null
      } else if (data2.data === -4 || data2.data === -5) { // -4：未扫描 -5 未确认
        console.log(data2.message)
      } else { // obj: 成功
        console.log(data2.message)
        await saveCookie()
        return http
      }

      await wait(1000)
    }
  }
}

async function saveCookie () {
  const obj = {}
  for (const [key, value] of cookieMap) {
    obj[key] = value
  }
  const json = JSON.stringify(obj)
  const filename = '.cookie.json'
  return fs.writeFile(filename, json)
}

async function loadCookie () {
  const filename = '.cookie.json'
  const json = await fs.readFile(filename)
  const obj = JSON.parse(json.toString())

  for (const key of Object.keys(obj)) {
    cookieMap.set(key, obj[key])
  }
}

async function main () {
  const api = await getAuthedApi()

  if (api) {
    const data2 = await request_nav(api)
    
    if (data2.data.isLogin) {
      console.log(`欢迎这个B友 ${data2.data.uname}! 等级: ${data2.data.level_info.current_level} 硬币: ${data2.data.money}`)

      const bvid = await questionAsync('请输入视频的bvid: '); // https://www.bilibili.com/video/BV18q4y1x7PH

      const data3 = await request_view(api, { bvid })
      const { pages } = data3
      if (pages?.length) {
        const cid = pages[0].cid
        const title = data3.title
        console.log(`视频标题: ${title}`)

        const data4 = await request_playurl(api, { bvid, cid})
        console.log(data4.support_formats)

        const downloadResult = await downloadVideo(http, data4, title)
        if (downloadResult) {
          console.error(downloadResult)
        } else {
          console.log(`下载完成 ${title}`)
        }
      }
    }
  }
  
}

main()
