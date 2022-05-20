interface SubtitleContent {
  body: {
    content: string,
    from: number,
    location: number,
    to: number
  }[]
}

// second to hh:mm:ss
function secondToTime (second: number) {
  const h = Math.floor(second / 3600)
  const m = Math.floor((second % 3600) / 60)
  const s = second % 60
  return `${h}:${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s.toFixed(2) : s.toFixed(2)}`
}

function jsonSubtitleToAss (sub: SubtitleContent) {
  const beginContent = 
`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  const dialogues = []

  for (const item of sub.body) {
    const timeFrom = secondToTime(item.from)
    const timeTo = secondToTime(item.to)
    const dialogue = `Dialogue: 0,${timeFrom},${timeTo},Default,,0,0,0,,${item.content}`

    dialogues.push(dialogue)
  }

  return beginContent + dialogues.join('\n')
}

export {
  jsonSubtitleToAss
}
