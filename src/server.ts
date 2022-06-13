import * as stream from 'stream'
import * as util from 'util'
import * as express from 'express'
import * as cookieParser from 'cookie-parser'
import { create } from 'xmlbuilder2'
import * as fs from 'fs-extra'
import { getVideoListAll, request_playurl, request_dm, request_nav, api_getLoginUrl, api_getLoginInfo, getSubtitleRaw } from './bilibili-api'
import { getAnonymousApi } from './index-api'
import { dandanApi } from './dandan-api'
import { streamCodecCopy, toBoolean, wait, buildPostParam } from './toolkit'
import { getLoginUrlResponse } from './bilibili-api-type'

const pipeline = util.promisify(stream.pipeline);

const app = express()
const PORT = Number(process.env.PORT || '8080')

let apiAwait = getAnonymousApi()

app.use(express.static('./src/web-player/dist'))
app.use(express.json())
app.use(cookieParser())

function getApiFromCookie (req: any) {
  const { BILIBILI_SITE_COOKIE } = req.cookies
  if (BILIBILI_SITE_COOKIE) {
    const cookieObj = JSON.parse(decodeURIComponent(BILIBILI_SITE_COOKIE))
    const api = getAnonymousApi()

    api.interceptors.request.use(config => {
      const cookieArray = []
      for (const key in cookieObj) {
        cookieArray.push(`${key}=${cookieObj[key]}`)
      }
      const cookieStr = cookieArray.join('; ')
      config.headers.cookie = cookieStr
      return config
    })

    return api
  } else {
    return getAnonymousApi()
  }
}

app.get(/dandan-api\/(.+)/, async (req, res) => {
  const path = req.params[0]
  const query = req.query
  
  try {
    const { data, status } = await dandanApi.get(path, { params: query })

    res.status(status)
    res.json(data)
  } catch (err) {
    res.send(err.data)
    res.status(err.status)
  }
})

app.post(/dandan-api\/(.+)/, async (req, res) => {
  try {
    const { data, status } = await dandanApi.post('match', req.body)

    res.status(status)
    res.json(data)
  } catch (err) {
    res.send(err.data)
    res.status(err.status)
  }
})

app.post('/api/to-mp4/:filename', async (req, res) => {
  const { filename } = req.params
  await streamCodecCopy(req, `./download/${filename}`)
  res.json({
    code: 0,
    msg: 'converted'
  })
})

app.get('/api/exists-mp4/:filename', async (req, res) => {
  const { filename } = req.params
  if (fs.existsSync(`./download/${filename}`)) {
    res.json({
      code: 0,
      msg: 'exists'
    })
  } else {
    res.json({
      code: 1,
      msg: 'not exists'
    })
  }
})

app.get('/api/get-mp4/:filename', async (req, res) => {
  const { filename } = req.params
  const filepath = `./download/${filename}`
  const stat = await fs.stat(filepath)
  const range = req.headers.range
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-")
    const start = parseInt(parts[0], 10)
    const end = parts[1]
      ? parseInt(parts[1], 10)
      : stat.size - 1
    const chunksize = (end - start) + 1
    const file = fs.createReadStream(filepath, { start, end })
    const head = {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    }
    res.writeHead(206, head)
    file.pipe(res)
  } else {
    const head = {
      'Content-Length': stat.size,
      'Content-Type': 'video/mp4',
    }
    res.writeHead(200, head)
    fs.createReadStream(filepath).pipe(res)
  }
})

app.get('/api/get-login-url', async (req, res) => {
  const res1 = await (await apiAwait).get(api_getLoginUrl)
  const loginResponse = res1.data as getLoginUrlResponse

  res.json(loginResponse)
})

app.get('/api/get-login-info', async (req, res) => {
  const { oauthKey } = req.query
  const res1 = await (await apiAwait).post(api_getLoginInfo, buildPostParam({ oauthKey }))
  
  if (res1.data.code === 0) {
    const set_cookie = res1.headers['set-cookie']
    if (set_cookie?.length > 0) {
      let cookieObj = {}
      for (const newCookie of set_cookie) {
        const cookie = newCookie.split(';')[0]
        const key = cookie.split('=')[0]
        const value = cookie.split('=')[1]
        cookieObj[key] = value
      }

      res.cookie('BILIBILI_SITE_COOKIE', encodeURIComponent(JSON.stringify(cookieObj)), {
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15),
        httpOnly: true
      })
    }
    res.json(res1.data)
  } else {
    res.json(res1.data)
  }
})

app.get('/api/nav', async (req, res) => {
  try {
    const navRes = await request_nav(getApiFromCookie(req))

    res.json(navRes)
  } catch (err) {
    res.json(err)
  }
})

app.get('/api/get-video-list', async (req, res) => {
  const { url, useProxy, proxyUrl } = req.query
  try {
    const videoList = await getVideoListAll(getApiFromCookie(req), url, toBoolean(useProxy) ? proxyUrl : undefined)

    res.json(videoList)
  } catch (error) {
    res.json({ error: error.toString() })
  }
})

app.get('/api/request-playurl', async (req, res) => {
  const { bvid, cid, useProxy, proxyUrl, isReplaceCDN } = req.query
  const fnval = 4048
  const playurlData = await request_playurl(getApiFromCookie(req), { bvid, cid, fnval }, toBoolean(useProxy) ? proxyUrl : undefined, toBoolean(isReplaceCDN))

  res.json(playurlData)
})

app.get('/api/request-mpd', async (req, res) => {
  const { bvid, cid } = req.query
  const fnval = 4048
  const playurlData = await request_playurl(await apiAwait, { bvid, cid, fnval })
  const { dash } = playurlData

  const RepresentationVideo = dash.video.map((video, index) => {
    return {
      '@id': index,
      '@codecs': video.codecs,
      '@bandwidth': video.bandwidth,
      '@width': video.width,
      '@height': video.height,
      '@frameRate': video.frame_rate,
      '@sar': video.sar,

      'BaseURL': { '#': `/api/stream?url=${encodeURIComponent(video.baseUrl)}` },
      'SegmentBase': { '@indexRange': video.segment_base.index_range, '@initialization': video.segment_base.initialization }
    }
  })

  const RepresentationAudio = dash.audio.map((audio, index) => {
    return {
      '@id': index,
      '@codecs': audio.codecs,
      '@bandwidth': audio.bandwidth,

      'BaseURL': { '#': `/api/stream?url=${encodeURIComponent(audio.baseUrl)}` },
      'SegmentBase': { '@indexRange': audio.segment_base.index_range, '@initialization': audio.segment_base.initialization }
    }
  })

  const AdaptationSet = [
    {
      '@mimeType': 'video/mp4', 
      '@contentType': 'video',
      'Representation': RepresentationVideo 
    },
    { 
      '@mimeType': 'audio/mp4',
      '@contentType': 'audio',
      'Representation': RepresentationAudio 
    }
  ]

  const xmlobj = {
    MPD: {
      '@mediaPresentationDuration': `PT${dash.duration}S`,
      '@minBufferTime': `PT${dash.min_buffer_time}S`, 
      '@profiles': 'urn:hbbtv:dash:profile:isoff-live:2012,urn:mpeg:dash:profile:isoff-live:2011',
      '@type': 'static',
      '@xmlns': 'urn:mpeg:dash:schema:mpd:2011',
      '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@xsi:schemaLocation': 'urn:mpeg:DASH:schema:MPD:2011 DASH-MPD.xsd',

      'Period': {
        'AdaptationSet': AdaptationSet
      }
    }
  }
  const doc = create(xmlobj)
  const xmlStr = doc.root().toString({ prettyPrint: true })

  res.set('content-type', 'application/dash+xml')
  res.send(xmlStr)
})

app.get('/api/stream', async (req, res) => {
  const { url } = req.query
  const range = req.headers['range']
  const secFetchDest = req.headers['sec-fetch-dest']
  const secFetchMode = req.headers['sec-fetch-mode']
  const secFetchSite = req.headers['sec-fetch-site']

  const api = await apiAwait
  const res1 = await api.get(url, { responseType: 'stream', headers: { 
    range: range || 'bytes=0-', 
    'sec-fetch-dest': secFetchDest || 'empty',
    'sec-fetch-mode': secFetchMode || 'cors',
    'sec-fetch-site': secFetchSite || 'same-origin' 
  }})

  function copyHeader (key: string) {
    const value = res1.headers[key]
    if (value) {
      res.set(key, value)
    }
  }

  copyHeader('content-type')
  copyHeader('content-length')
  copyHeader('content-range')

  res.status(res1.status)

  pipeline(res1.data, res).catch(err => {
    console.error(err)
  })
})

app.get('/api/dm-seg', async (req, res) => {
  const { cid, segment_index } = req.query
  const dms = await request_dm(getApiFromCookie(req), { oid: cid, type: 1, segment_index })

  res.json(dms)
})

app.get('/api/subtitles', async (req, res) => {
  const { bvid, useProxy, proxyUrl } = req.query
  const subs = await getSubtitleRaw(getApiFromCookie(req), bvid, toBoolean(useProxy) ? proxyUrl : undefined)

  res.json(subs)
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is listening on port ${PORT}`)
})
