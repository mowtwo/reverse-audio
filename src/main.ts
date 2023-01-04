export { }

const file = document.querySelector('.audio') as HTMLInputElement
const player = document.querySelector('.player') as HTMLAudioElement

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
})
