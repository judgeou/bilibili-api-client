import axios from 'axios'

const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.54 Safari/537.36 Edg/101.0.1210.39`

let dandanApi = axios.create({
  baseURL: 'https://api.acplay.net/api/v2',
  headers: {
    'Accept': 'application/json',
    'User-Agent': userAgent
  }
})

export {
  dandanApi
}