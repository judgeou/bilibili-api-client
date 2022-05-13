import { AxiosInstance } from 'axios'

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

interface navResponse {
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

interface viewResponse {
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

const api_getLoginUrl = 'https://passport.bilibili.com/qrcode/getLoginUrl'
const api_getLoginInfo = 'https://passport.bilibili.com/qrcode/getLoginInfo'
const api_nav = 'https://api.bilibili.com/nav'
const api_view = 'https://api.bilibili.com/x/web-interface/view'

async function request_nav (api: AxiosInstance) {
  const res1 = await api.get(api_nav)
  const data2 = res1.data as navResponse

  if (data2.code === 0) {
    return data2
  } else {
    throw Error(data2.message)
  }
}

async function request_view (api: AxiosInstance, param: { bvid?: string, aid?: string }) {
  const res1 = await api.get(api_view, { params: param })
  const data1 = res1.data as viewResponse

  if (data1.code === 0) {
    return data1.data
  } else {
    throw Error(data1.message)
  }
}

export {
  getLoginUrlResponse,
  getLoginInfoResponse,
  navResponse,

  api_getLoginUrl,
  api_getLoginInfo,
  api_nav,
  api_view,

  request_nav,
  request_view
}