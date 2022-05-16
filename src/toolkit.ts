import * as qs from 'qs'
import * as FormData from 'form-data'
import * as QRCode from 'qrcode'
import * as open from 'open'
import * as readline from 'readline'
import { spawn } from 'child_process'

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

async function isFFMPEGInstalled () {
  return new Promise((resolve) => {
    const program = spawn('ffmpeg', ['-version'])
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

export {
  buildFormData,
  buildPostParam,
  openQRCodeBrowser,
  printOneLine,
  questionAsync,
  showQRCodeConsole,
  showQRCodeFile,
  wait,
  isFFMPEGInstalled
}
