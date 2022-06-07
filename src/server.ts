import * as stream from 'stream'
import * as util from 'util'
import * as express from 'express'
import { create } from 'xmlbuilder2'
import { getVideoListAll, request_playurl } from './bilibili-api'
import { getAuthedApi } from './index-api'
import { dandanApi } from './dandan-api'

const pipeline = util.promisify(stream.pipeline);

const app = express()
const PORT = Number(process.env.PORT || '8080')

let apiAwait = getAuthedApi()

app.use(express.static('./src/web-player/dist'))
app.use(express.json())

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

app.get('/api/get-video-list', async (req, res) => {
  const { url } = req.query
  try {
    const videoList = await getVideoListAll(await apiAwait, url)

    res.json(videoList)
  } catch (error) {
    res.json({ error: error.toString() })
  }
})

app.get('/api/request-playurl', async (req, res) => {
  const { bvid, cid } = req.query
  const fnval = 4048
  const playurlData = await request_playurl(await apiAwait, { bvid, cid, fnval })

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is listening on port ${PORT}`)
})
