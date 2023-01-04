export { }

const file = document.querySelector('.audio') as HTMLInputElement
const player = document.querySelector('.player') as HTMLAudioElement
const recorder = document.querySelector('.recorder') as HTMLButtonElement

const decodeAudioData = (context: AudioContext, buffer: ArrayBuffer) => new Promise<AudioBuffer>((resolve, reject) => {
  context.decodeAudioData(buffer, resolve, reject)
})

const reverseAudioBuffer = (buffer: AudioBuffer) => {
  let t = 0
  while (t < buffer.numberOfChannels) {
    const channel = buffer.getChannelData(t++)
    const len = channel.length - 1
    const len2 = len >>> 1
    for (let i = 0; i < len2; i++) {
      const temp = channel[len - i]
      channel[len - i] = channel[i]
      channel[i] = temp
    }
  }
  return buffer
}

// Returns Uint8Array of WAV bytes
function getWavBytes(buffer: ArrayBufferLike, options: {
  isFloat: boolean
  numChannels: number
  sampleRate: number
}) {
  const type = options.isFloat ? Float32Array : Uint16Array
  const numFrames = buffer.byteLength / type.BYTES_PER_ELEMENT

  const headerBytes = getWavHeader(Object.assign({}, options, { numFrames }))
  const wavBytes = new Uint8Array(headerBytes.length + buffer.byteLength);

  // prepend header, then add pcmBytes
  wavBytes.set(headerBytes, 0)
  wavBytes.set(new Uint8Array(buffer), headerBytes.length)

  return wavBytes
}

// adapted from https://gist.github.com/also/900023
// returns Uint8Array of WAV header bytes
function getWavHeader(options: {
  isFloat: boolean
  numChannels: number
  sampleRate: number
  numFrames: number
}) {
  const numFrames = options.numFrames
  const numChannels = options.numChannels || 2
  const sampleRate = options.sampleRate || 44100
  const bytesPerSample = options.isFloat ? 4 : 2
  const format = options.isFloat ? 3 : 1

  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = numFrames * blockAlign

  const buffer = new ArrayBuffer(44)
  const dv = new DataView(buffer)

  let p = 0

  function writeString(s: string) {
    for (let i = 0; i < s.length; i++) {
      dv.setUint8(p + i, s.charCodeAt(i))
    }
    p += s.length
  }

  function writeUint32(d: number) {
    dv.setUint32(p, d, true)
    p += 4
  }

  function writeUint16(d: number) {
    dv.setUint16(p, d, true)
    p += 2
  }

  writeString('RIFF')              // ChunkID
  writeUint32(dataSize + 36)       // ChunkSize
  writeString('WAVE')              // Format
  writeString('fmt ')              // Subchunk1ID
  writeUint32(16)                  // Subchunk1Size
  writeUint16(format)              // AudioFormat https://i.stack.imgur.com/BuSmb.png
  writeUint16(numChannels)         // NumChannels
  writeUint32(sampleRate)          // SampleRate
  writeUint32(byteRate)            // ByteRate
  writeUint16(blockAlign)          // BlockAlign
  writeUint16(bytesPerSample * 8)  // BitsPerSample
  writeString('data')              // Subchunk2ID
  writeUint32(dataSize)            // Subchunk2Size

  return new Uint8Array(buffer)
}

const AudioBufferToBlob = (buffer: AudioBuffer) => {

  const [l, r] = [buffer.getChannelData(0), buffer.getChannelData(1)]
  const interleaved = new Float32Array(l.length + r.length)
  for (let s = 0, d = 0; s < l.length; s++, d += 2) {
    interleaved[d] = l[s]
    interleaved[d + 1] = r[s]
  }

  const bytes = getWavBytes(interleaved.buffer, {
    isFloat: true,       // floating point or 16-bit integer
    numChannels: 2,
    sampleRate: 48000,
  })

  return new Blob([bytes], {
    type: 'audio/wav'
  })
}

const download = (name: string, blob: Blob) => {
  const link = document.createElement('a')
  link.download = name
  link.href = URL.createObjectURL(blob)
  link.click()
}


file.addEventListener('change', async () => {
  const context = new AudioContext()
  const audio = file.files![0]!
  const buffer = await decodeAudioData(context, await audio.arrayBuffer())

  const source = context.createBufferSource()
  source.buffer = reverseAudioBuffer(buffer)
  const streamNode = context.createMediaStreamDestination()
  source.connect(streamNode)
  player.srcObject = streamNode.stream
  source.start(0)

  const blob = AudioBufferToBlob(buffer)
  download(`${Date.now()}.wav`, blob)
})

let audioChunks = [] as Blob[]
let mediaRecorder: MediaRecorder | undefined
recorder.addEventListener('click', async () => {

  if (!!mediaRecorder) {
    mediaRecorder.stop()
    mediaRecorder = undefined
    recorder.innerHTML = '录音'
    const saveChunks = audioChunks
    audioChunks = []

    const context = new AudioContext()

    const buffer = await decodeAudioData(context, await (new Blob(saveChunks)).arrayBuffer())

    const source = context.createBufferSource()
    source.buffer = reverseAudioBuffer(buffer)
    const streamNode = context.createMediaStreamDestination()
    source.connect(streamNode)
    player.srcObject = streamNode.stream
    source.start(0)

    return
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.start()
    recorder.innerHTML = '正在录音'

    mediaRecorder.addEventListener('dataavailable', e => {
      const { data } = e
      audioChunks.push(data)
    })
  } catch {
    alert('获取录音设备失败')
  }
})
