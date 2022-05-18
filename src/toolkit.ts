import * as qs from 'qs'
import * as FormData from 'form-data'
import * as QRCode from 'qrcode'
import * as open from 'open'
import * as readline from 'readline'
import * as path from 'path'
import * as fs from 'fs-extra'
import { spawn } from 'child_process'

let ffmpeg_bin_path = 'ffmpeg'

function buildFormData (obj) {
  const formData = new FormData()
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      formData.append(key, obj[key])
    }
  }
  return formData
}

function buildPostParam (obj) {
  return qs.stringify(obj)
}

function showQRCodeConsole (url) {
  QRCode.toString(url, { type: 'terminal', small: true }, (err, url) => {
    console.log(url)
  })
}

async function openQRCodeBrowser (url) {
  const dataURL = await QRCode.toDataURL(url)
  open(dataURL)
}

async function showQRCodeFile (url) {
  const filename = 'login-qrcode.png'
  await QRCode.toFile(filename, url, { type: 'png' })
  return open(filename)
}

async function wait (ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

async function questionAsync (q: string): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    rl.question(q, answer => {
      rl.close()
      resolve(answer)
    })
  })
}

function printOneLine (str: string) {
  process.stdout.write(str + '\r')
}

async function isFFMPEGInstalled () : Promise<boolean> {
  // check bin dir
  const { platform, arch } = process
  const binExt = platform === 'win32' ? '.exe' : ''
  const binPath = path.resolve('./bin', `ffmpeg_${platform}_${arch}${binExt}`)
  const binExists = await fs.exists(binPath)

  if (binExists) {
    ffmpeg_bin_path = binPath
    console.log(`${binPath} found`)
  } else {
    console.log(`${binPath} not found`)
  }

  return new Promise((resolve) => {
    const program = spawn(ffmpeg_bin_path, ['-version'])
    program.stdout.on('data', data => {
      resolve(true)
    })

    program.stderr.on('data', data => {
      resolve(false)
    })

    program.on('error', err => {
      resolve(false)
    })
  })
}

async function mergeMedia (mediaFilepaths: string[], outputFilepath: string) {
  return new Promise((resolve, reject) => {
    let args = []
    for (const mediaFilepath of mediaFilepaths) {
      args.push('-i')
      args.push(mediaFilepath)
    }
    args = [...args, '-c', 'copy', '-y', outputFilepath]
    const ffmpeg = spawn(ffmpeg_bin_path, args)
  
    ffmpeg.stdout.pipe(process.stdout)
  
    ffmpeg.stderr.pipe(process.stderr)
  
    ffmpeg.on('close', code => {
      if (code === 0) {
        resolve(true)
      } else {
        reject(false)
      }
    })
  })
}

export {
  buildFormData,
  buildPostParam,
  mergeMedia,
  openQRCodeBrowser,
  printOneLine,
  questionAsync,
  showQRCodeConsole,
  showQRCodeFile,
  wait,
  isFFMPEGInstalled
}
