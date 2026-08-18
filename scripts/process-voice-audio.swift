import AVFoundation
import Foundation

private struct AudioSamples {
  let samples: [Float]
  let sampleRate: Double
}

private struct ParentClip {
  let sourceName: String
  let destination: String
}

private let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
private let sourceDirectory = root.appendingPathComponent("user-generated-audio", isDirectory: true)
private let audioDirectory = root.appendingPathComponent("src/assets/audio", isDirectory: true)
private let targetSampleRate = 48_000.0
private let targetSpeechRms = pow(10.0, -20.0 / 20.0)
private let maximumPeak = pow(10.0, -1.5 / 20.0)

private let numberWords = [
  "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten"
]

private let parentClips: [ParentClip] = [
  ParentClip(
    sourceName: "opening-dialogue.m4a",
    destination: "number-exploration/opening-dialogue.wav"
  ),
  ParentClip(sourceName: "one.m4a", destination: "number-exploration/one.wav"),
  ParentClip(sourceName: "two.m4a", destination: "number-exploration/two.wav"),
  ParentClip(sourceName: "three.m4a", destination: "number-exploration/three.wav"),
  ParentClip(sourceName: "four.m4a", destination: "number-exploration/four.wav"),
  ParentClip(sourceName: "five.m4a", destination: "number-exploration/five.wav"),
  ParentClip(sourceName: "six.m4a", destination: "number-exploration/six.wav"),
  ParentClip(sourceName: "seven.m4a", destination: "number-exploration/seven.wav"),
  ParentClip(sourceName: "eight.m4a", destination: "number-exploration/eight.wav"),
  ParentClip(sourceName: "nine.m4a", destination: "number-exploration/nine.wav"),
  ParentClip(sourceName: "ten.m4a", destination: "number-exploration/ten.wav"),
  ParentClip(sourceName: "good-work.m4a", destination: "feedback/correct/good-work.wav"),
  ParentClip(sourceName: "great-job.m4a", destination: "feedback/correct/great-job.wav"),
  ParentClip(sourceName: "thats-right.m4a", destination: "feedback/correct/thats-right.wav"),
  ParentClip(sourceName: "try-again.m4a", destination: "feedback/incorrect/try-again.wav")
]

private func loadAudio(from url: URL) throws -> AudioSamples {
  let asset = AVURLAsset(url: url)
  guard let track = asset.tracks(withMediaType: .audio).first else {
    throw NSError(domain: "VoiceAudio", code: 1, userInfo: [
      NSLocalizedDescriptionKey: "Could not find an audio track in \(url.lastPathComponent)."
    ])
  }

  let reader = try AVAssetReader(asset: asset)
  let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
    AVFormatIDKey: kAudioFormatLinearPCM,
    AVLinearPCMBitDepthKey: 32,
    AVLinearPCMIsFloatKey: true,
    AVLinearPCMIsBigEndianKey: false,
    AVLinearPCMIsNonInterleaved: false
  ])

  guard reader.canAdd(output) else {
    throw NSError(domain: "VoiceAudio", code: 2, userInfo: [
      NSLocalizedDescriptionKey: "Could not configure audio decoding for \(url.lastPathComponent)."
    ])
  }
  reader.add(output)

  guard reader.startReading() else {
    throw reader.error ?? NSError(domain: "VoiceAudio", code: 3, userInfo: [
      NSLocalizedDescriptionKey: "Could not start decoding \(url.lastPathComponent)."
    ])
  }

  var samples: [Float] = []
  var decodedSampleRate: Double?
  while let sampleBuffer = output.copyNextSampleBuffer() {
    guard
      let formatDescription = CMSampleBufferGetFormatDescription(sampleBuffer),
      let streamDescription = CMAudioFormatDescriptionGetStreamBasicDescription(formatDescription)
    else {
      throw NSError(domain: "VoiceAudio", code: 4, userInfo: [
        NSLocalizedDescriptionKey: "Could not read the decoded format of \(url.lastPathComponent)."
      ])
    }
    let channelCount = Int(streamDescription.pointee.mChannelsPerFrame)
    decodedSampleRate = streamDescription.pointee.mSampleRate

    if let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) {
      let byteCount = CMBlockBufferGetDataLength(blockBuffer)
      var bytes = Data(count: byteCount)
      let status = bytes.withUnsafeMutableBytes { rawBuffer in
        CMBlockBufferCopyDataBytes(
          blockBuffer,
          atOffset: 0,
          dataLength: byteCount,
          destination: rawBuffer.baseAddress!
        )
      }
      guard status == kCMBlockBufferNoErr else {
        throw NSError(domain: "VoiceAudio", code: 5, userInfo: [
          NSLocalizedDescriptionKey: "Could not copy decoded samples from \(url.lastPathComponent)."
        ])
      }
      bytes.withUnsafeBytes { rawBuffer in
        let interleaved = rawBuffer.bindMemory(to: Float.self)
        let frameCount = interleaved.count / channelCount
        for frame in 0..<frameCount {
          var monoSample: Float = 0
          for channel in 0..<channelCount {
            monoSample += interleaved[frame * channelCount + channel] / Float(channelCount)
          }
          samples.append(monoSample)
        }
      }
    }
    CMSampleBufferInvalidate(sampleBuffer)
  }

  if reader.status == .failed {
    throw reader.error ?? NSError(domain: "VoiceAudio", code: 6, userInfo: [
      NSLocalizedDescriptionKey: "Could not finish decoding \(url.lastPathComponent)."
    ])
  }

  guard let decodedSampleRate else {
    throw NSError(domain: "VoiceAudio", code: 7, userInfo: [
      NSLocalizedDescriptionKey: "No audio samples were decoded from \(url.lastPathComponent)."
    ])
  }
  return AudioSamples(samples: samples, sampleRate: decodedSampleRate)
}

private func resample(_ audio: AudioSamples, to sampleRate: Double) -> AudioSamples {
  guard abs(audio.sampleRate - sampleRate) > 0.5, audio.samples.count > 1 else {
    return audio
  }

  let ratio = audio.sampleRate / sampleRate
  let outputCount = Int((Double(audio.samples.count) / ratio).rounded(.down))
  var output = [Float](repeating: 0, count: outputCount)

  for outputIndex in 0..<outputCount {
    let sourcePosition = Double(outputIndex) * ratio
    let lowerIndex = min(Int(sourcePosition), audio.samples.count - 1)
    let upperIndex = min(lowerIndex + 1, audio.samples.count - 1)
    let fraction = Float(sourcePosition - Double(lowerIndex))
    output[outputIndex] = audio.samples[lowerIndex] * (1 - fraction)
      + audio.samples[upperIndex] * fraction
  }

  return AudioSamples(samples: output, sampleRate: sampleRate)
}

private func rms(_ samples: ArraySlice<Float>) -> Double {
  guard !samples.isEmpty else { return 0 }
  let energy = samples.reduce(0.0) { partial, sample in
    partial + Double(sample * sample)
  }
  return sqrt(energy / Double(samples.count))
}

private func trimmedRange(for samples: [Float], sampleRate: Double) -> Range<Int> {
  let windowSize = max(1, Int(sampleRate * 0.02))
  let peak = samples.lazy.map { abs($0) }.max() ?? 0
  let threshold = max(pow(10.0, -50.0 / 20.0), Double(peak) * 0.01)
  var firstActive: Int?
  var lastActive: Int?

  var start = 0
  while start < samples.count {
    let end = min(start + windowSize, samples.count)
    if rms(samples[start..<end]) >= threshold {
      firstActive = firstActive ?? start
      lastActive = end
    }
    start = end
  }

  guard let firstActive, let lastActive else {
    return 0..<samples.count
  }

  let leadingPadding = Int(sampleRate * 0.08)
  let trailingPadding = Int(sampleRate * 0.12)
  return max(0, firstActive - leadingPadding)..<min(samples.count, lastActive + trailingPadding)
}

private func activeSpeechRms(_ samples: [Float], sampleRate: Double) -> Double {
  let windowSize = max(1, Int(sampleRate * 0.05))
  var windowLevels: [Double] = []
  var start = 0

  while start < samples.count {
    let end = min(start + windowSize, samples.count)
    windowLevels.append(rms(samples[start..<end]))
    start = end
  }

  let maximumWindowRms = windowLevels.max() ?? 0
  let gate = max(pow(10.0, -42.0 / 20.0), maximumWindowRms * 0.08)
  let activeWindows = windowLevels.filter { $0 >= gate }
  guard !activeWindows.isEmpty else { return rms(samples[...]) }

  let meanSquare = activeWindows.reduce(0.0) { $0 + $1 * $1 } / Double(activeWindows.count)
  return sqrt(meanSquare)
}

private func process(_ audio: AudioSamples) -> (audio: AudioSamples, gainDb: Double) {
  let resampled = resample(audio, to: targetSampleRate)
  let range = trimmedRange(for: resampled.samples, sampleRate: resampled.sampleRate)
  var samples = Array(resampled.samples[range])
  let speechRms = activeSpeechRms(samples, sampleRate: resampled.sampleRate)
  let peak = Double(samples.lazy.map { abs($0) }.max() ?? 0)

  var gain = speechRms > 0 ? targetSpeechRms / speechRms : 1
  if peak > 0 {
    gain = min(gain, maximumPeak / peak)
  }

  for index in samples.indices {
    samples[index] = Float(Double(samples[index]) * gain)
  }

  let fadeFrames = min(Int(resampled.sampleRate * 0.01), samples.count / 2)
  if fadeFrames > 0 {
    for frame in 0..<fadeFrames {
      let fade = Float(frame) / Float(fadeFrames)
      samples[frame] *= fade
      samples[samples.count - 1 - frame] *= fade
    }
  }

  return (
    AudioSamples(samples: samples, sampleRate: resampled.sampleRate),
    20 * log10(max(gain, 0.000_001))
  )
}

private func appendLittleEndian<T: FixedWidthInteger>(_ value: T, to data: inout Data) {
  var littleEndian = value.littleEndian
  withUnsafeBytes(of: &littleEndian) { data.append(contentsOf: $0) }
}

private func writeWave(_ audio: AudioSamples, to url: URL) throws {
  try FileManager.default.createDirectory(
    at: url.deletingLastPathComponent(),
    withIntermediateDirectories: true
  )

  let sampleRate = UInt32(audio.sampleRate.rounded())
  let dataByteCount = UInt32(audio.samples.count * MemoryLayout<Int16>.size)
  var data = Data()
  data.append(contentsOf: "RIFF".utf8)
  appendLittleEndian(UInt32(36) + dataByteCount, to: &data)
  data.append(contentsOf: "WAVE".utf8)
  data.append(contentsOf: "fmt ".utf8)
  appendLittleEndian(UInt32(16), to: &data)
  appendLittleEndian(UInt16(1), to: &data)
  appendLittleEndian(UInt16(1), to: &data)
  appendLittleEndian(sampleRate, to: &data)
  appendLittleEndian(sampleRate * 2, to: &data)
  appendLittleEndian(UInt16(2), to: &data)
  appendLittleEndian(UInt16(16), to: &data)
  data.append(contentsOf: "data".utf8)
  appendLittleEndian(dataByteCount, to: &data)

  for sample in audio.samples {
    let clamped = max(-1.0, min(1.0, sample))
    appendLittleEndian(Int16((clamped * Float(Int16.max)).rounded()), to: &data)
  }

  try data.write(to: url, options: .atomic)
}

private func run(_ executable: String, arguments: [String]) throws {
  let process = Process()
  process.executableURL = URL(fileURLWithPath: executable)
  process.arguments = arguments
  try process.run()
  process.waitUntilExit()
  guard process.terminationStatus == 0 else {
    throw NSError(domain: "VoiceAudio", code: Int(process.terminationStatus), userInfo: [
      NSLocalizedDescriptionKey: "\(executable) failed with status \(process.terminationStatus)."
    ])
  }
}

private func processFile(source: URL, destination: URL) throws {
  let original = try loadAudio(from: source)
  let result = process(original)
  try writeWave(result.audio, to: destination)

  let originalDuration = Double(original.samples.count) / original.sampleRate
  let processedDuration = Double(result.audio.samples.count) / result.audio.sampleRate
  print(
    "\(destination.path.replacingOccurrences(of: root.path + "/", with: "")): "
      + String(format: "%.2fs → %.2fs, gain %+.1f dB", originalDuration, processedDuration, result.gainDb)
  )
}

for clip in parentClips {
  try processFile(
    source: sourceDirectory.appendingPathComponent(clip.sourceName),
    destination: audioDirectory.appendingPathComponent(clip.destination)
  )
}

let temporaryDirectory = FileManager.default.temporaryDirectory
  .appendingPathComponent("counting-game-machine-voice-\(UUID().uuidString)", isDirectory: true)
try FileManager.default.createDirectory(at: temporaryDirectory, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: temporaryDirectory) }

for word in numberWords {
  let generatedSource = temporaryDirectory.appendingPathComponent("thats-\(word).aiff")
  try run("/usr/bin/say", arguments: [
    "-v", "Samantha",
    "-o", generatedSource.path,
    "That's \(word)."
  ])

  try processFile(
    source: generatedSource,
    destination: audioDirectory.appendingPathComponent(
      "feedback/incorrect/machine/thats-\(word).wav"
    )
  )
}
