import * as fs from 'fs-extra'
import { jsonSubtitleToAss } from '../src/subtitle'

async function testSubtitleConvert () {
  const jsonStr = await fs.readFile('./test/subtitle-json-example.json')
  const json = JSON.parse(jsonStr.toString())

  console.log(jsonSubtitleToAss(json))
}

testSubtitleConvert()
