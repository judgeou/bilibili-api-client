import * as qs from 'qs'
import * as FormData from 'form-data'
import * as QRCode from 'qrcode'
import * as open from 'open'
import * as readline from 'readline'
import * as path from 'path'
import * as fs from 'fs-extra'
import { spawn } from 'child_process'

let ffmpeg_bin_path = 'ffmpeg'

function formatDate (date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()
  return `${year}-${month}-${day} ${hour}-${minute}-${second}`
}

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

async function printDownloadInfoLoop (filepath: string, state: { exit: boolean }, totalSize: number = 0) {
  for (let written = 0; state.exit === false;) {
    if (await fs.exists(filepath)) {
      const stat = await fs.stat(filepath)
      const writtenPerSecond = (stat.size - written)
      written = stat.size

      if (totalSize > 0) {
        printOneLine(`downloading ${filepath} ${(written / totalSize * 100).toFixed(2)}% ${(writtenPerSecond / 1024 / 1024).toFixed(2)} MB/S \r`)
      } else {
        printOneLine(`downloading ${written / 1024 /1024} MB ${(writtenPerSecond / 1024 / 1024).toFixed(2)} MB/S \r`)
      }
    }

    await wait(1000)
  }
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
    let args = ['-v', 'error']
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

async function playMedia (mediaFilepaths: string[]) {
  return new Promise((resolve, reject) => {
    let args = []
    for (const mediaFilepath of mediaFilepaths) {
      args.push('-i')
      args.push(mediaFilepath)
    }
    args = [...args, '-c', 'copy', '-f', 'matroska', '-']
    const ffmpeg = spawn(ffmpeg_bin_path, args)

    const ffplay = spawn('ffplay', ['-x', '500', '-'])
  
    ffmpeg.stdout.pipe(ffplay.stdin)
    ffmpeg.stdout.on('error', err => {
      resolve(true)
    })
    ffplay.stdin.on('error', err => {
      resolve(true)
    })
  
    ffmpeg.on('close', code => {
      resolve(true)
    })

    ffmpeg.on('error', err => {
      resolve(true)
    })
    
    ffplay.on('close', code => {
      resolve(true)
    })

    ffplay.on('error', err => {
      resolve(true)
    })
  })
}

export {
  buildFormData,
  buildPostParam,
  formatDate,
  mergeMedia,
  playMedia,
  openQRCodeBrowser,
  printOneLine,
  questionAsync,
  showQRCodeConsole,
  showQRCodeFile,
  wait,
  isFFMPEGInstalled,
  printDownloadInfoLoop
}
