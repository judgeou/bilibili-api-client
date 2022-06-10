export interface getLoginUrlResponse {
  code: number,
  data: {
    url: string,
    oauthKey: string,
  }
}

export interface getLoginInfoResponse {
  message: string,
  status: boolean,
  data: number | {}
}

export interface NavResponse {
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

export interface ViewResponse {
  code: number,
  message: string,
  data: {
    bvid: string,
    aid: number,
    videos: number,
    title: string,
    subtitle: {
      list: {
        lan: string,
        lan_doc: string,
        subtitle_url: string
      }[]
    }
    pages: {
      cid: number,
      part: string,
      page: number
    }[]
  }
}

export interface DurlData {
  order: number,
  url: string,
  size: number,
}

export interface DashData {
  duration: number,
  min_buffer_time: number,

  video: {
    width: number,
    height: number,
    bandwidth: number,
    frame_rate: string,
    id: number, // Quality
    backupUrl: string[],
    backup_url: string[],
    baseUrl: string,
    base_url: string,
    codecid: number, // CODECID
    codecs: string,
    mime_type: string,
    sar: string,
    segment_base: {
      index_range: string,
      initialization: string
    }
  }[],
  audio: {
    bandwidth: number,
    id: number, // Quality
    backupUrl: string[],
    backup_url: string[],
    baseUrl: string,
    base_url: string,
    codecid: number, // CODECID
    codecs: string,
    mime_type: string,
    segment_base: {
      index_range: string,
      initialization: string
    }
  }[]
}

export interface PlayurlData {
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

export interface PlayurlResponse {
  code: number,
  message: string,
  data: PlayurlData
}

export interface SeasonData {
  season_title: string,
  evaluate: string,
  episodes: {
    bvid: string,
    cid: number,
    long_title: string,
  }[]
}

export interface SeasonResponse {
  code: number,
  message: string,
  result: SeasonData
}

export interface RoomInitResponse {
  code: number,
  message: string,
  data: {
    room_id: number,
  }
}

export interface RoomPlayurlResponse {
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

export interface VideoItem {
  bvid: string,
  cid: number,
  title: string,
  page: number
}

export interface VideoInfo {
  title: string
  list: VideoItem[]
}

export interface DanmakuElem {
  color: number,
  content: string,
  fontsize: number,
  mode: number,
  progress: number,
  weight: number,
}

export interface DmSegMobileReply {
  elems: DanmakuElem[]
}