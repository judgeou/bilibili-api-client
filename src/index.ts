import axios from 'axios'
import * as fs from 'fs-extra'
import * as inquirer from 'inquirer'
import { api_getLoginInfo, api_getLoginUrl, downloadVideo, getLoginInfoResponse, getLoginUrlResponse, request_nav, request_playurl, request_view } from './bilibili-api'
import { buildPostParam, printOneLine, questionAsync, showQRCodeConsole, wait, isFFMPEGInstalled } from './toolkit'

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

    saveCookie()
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
    await showQRCodeConsole(data1.data.url)

    for (let data2: getLoginInfoResponse; ; ) {
      const res2 = await http.post(api_getLoginInfo, buildPostParam({
        oauthKey: data1.data.oauthKey
      }))
      data2 = res2.data

      if (data2.data === -1 || data2.data === -2) { // -1：密钥错误 -2：密钥超时
        console.log(data2.message)
        return null
      } else if (data2.data === -4) { // -4：未扫描 -5 未确认
        printOneLine('等待扫描')
      } else if (data2.data === -5) {
        printOneLine('等待确认')
      } else { // obj: 成功
        console.log(data2.message)
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
  let api = await getAuthedApi()

  if (api) {
    let data2
    try { 
      data2 = await request_nav(api)
    } catch {
      console.log('cookie 已失效，重新获取')
      await fs.remove('.cookie.json')
      api = await getAuthedApi()
      data2 = await request_nav(api)
    }
    
    if (data2.data.isLogin) {
      console.log(`欢迎这个B友 ${data2.data.uname}! 等级: ${data2.data.level_info.current_level} 硬币: ${data2.data.money}`)

      const bvid = await questionAsync('请输入视频的bvid: '); // https://www.bilibili.com/video/BV18q4y1x7PH

      const data3 = await request_view(api, { bvid })
      const { pages } = data3
      if (pages?.length) {
        const cid = pages[0].cid
        const title = data3.title
        console.log(`视频标题: ${title}`)

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

        let data4 = await request_playurl(api, { bvid, cid, qn: 120, fnval })
        
        const answerQuality = await inquirer.prompt(
          {
            type: 'rawlist',
            name: 'quality',
            message: '请选择视频质量',
            choices: data4.accept_description.map((value, index) => {
              return {
                key: index.toString(),
                name: value,
                value: data4.accept_quality[index]
              }
            })
          }
        )

        if (answerQuality.quality !== data4.quality) {
          data4 = await request_playurl(api, { bvid, cid, qn: answerQuality.quality, fnval: 0 })
        }

        const ouputFilepath = await downloadVideo(http, data4, title)
        console.log(`下载完成 ${ouputFilepath}`)
      }
    }
  }
  
}

main()
