// Biến đoạn thu âm của trình duyệt thành tệp WAV mà model nghe được.
//
// Vì sao phải đổi, thay vì gửi thẳng thứ MediaRecorder tạo ra:
//
//   1. Mỗi trình duyệt ghi ra một định dạng khác nhau — Chrome/Firefox cho
//      webm/opus, Safari cho mp4/aac. Gửi thẳng lên là phó mặc cho nhà cung cấp
//      model có đọc được đúng định dạng đó không, và lỗi chỉ lộ ra trên đúng cái
//      máy của người dùng đó.
//   2. Giải mã rồi mã hoá lại thành WAV 16kHz mono cho ra MỘT định dạng duy nhất
//      cho mọi trình duyệt — cũng chính là định dạng model ASR muốn nghe.
//   3. 16kHz mono nhẹ hơn hẳn 48kHz stereo mà model không nghe khác đi: tiếng
//      nói nằm gọn dưới 8kHz.
//
// decodeAudioData của trình duyệt lo phần giải mã, nên chỗ này không cần thư viện.

// Model ASR nào cũng lấy mẫu ở 16kHz. Gửi cao hơn thì chính nhà cung cấp hạ
// xuống, chỉ tốn thêm dung lượng tải lên.
const TARGET_SAMPLE_RATE = 16000;

// Trộn mọi kênh thành một. Micro laptop thường là mono sẵn, nhưng tai nghe cắm
// vào có thể ra stereo — lấy mỗi kênh trái là mất tiếng nếu micro nằm bên phải.
function toMono(audioBuffer) {
  const { numberOfChannels, length } = audioBuffer;
  if (numberOfChannels === 1) return audioBuffer.getChannelData(0);

  const mixed = new Float32Array(length);
  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) mixed[i] += data[i] / numberOfChannels;
  }
  return mixed;
}

// Hạ tần số lấy mẫu bằng nội suy tuyến tính. Lấy mẫu thưa ra kiểu "cứ 3 mẫu lấy
// 1" thì tiếng bị rè; nội suy giữa hai mẫu gần nhất cho ra giọng sạch, đủ tốt
// cho giọng nói và rẻ hơn nhiều so với một bộ lọc đầy đủ.
function resample(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;

  const ratio = fromRate / toRate;
  const outLength = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLength);

  for (let i = 0; i < outLength; i += 1) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    const current = samples[index] ?? 0;
    const next = samples[index + 1] ?? current;
    out[i] = current + (next - current) * fraction;
  }

  return out;
}

// Đóng gói mẫu 16-bit vào container WAV: 44 byte header rồi tới dữ liệu.
function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeText = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true); // độ dài khối fmt
  view.setUint16(20, 1, true); // 1 = PCM không nén
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte mỗi giây
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  // Float -1..1 → số nguyên 16-bit. Kẹp lại trước khi nhân: mẫu vượt biên (micro
  // quá to) mà để tràn thì tiếng nổ lụp bụp đúng chỗ to nhất của câu.
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Đoạn thu âm thô của trình duyệt → WAV 16kHz mono.
 *
 * @param {Blob} recorded  Thứ MediaRecorder trả về (webm/opus, mp4/aac...)
 * @returns {Promise<Blob>}
 */
export async function toWavBlob(recorded) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Trình duyệt không hỗ trợ xử lý âm thanh.");

  const arrayBuffer = await recorded.arrayBuffer();
  const context = new AudioContextClass();

  try {
    // Safari bản cũ chỉ có kiểu callback, không trả Promise
    const audioBuffer = await new Promise((resolve, reject) => {
      const decoded = context.decodeAudioData(arrayBuffer, resolve, reject);
      if (decoded?.then) decoded.then(resolve, reject);
    });

    const mono = toMono(audioBuffer);
    const samples = resample(mono, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
    return encodeWav(samples, TARGET_SAMPLE_RATE);
  } finally {
    // Trình duyệt chỉ cho mở vài chục AudioContext trước khi từ chối cái tiếp
    // theo — mỗi lượt nói mở một cái mà không đóng thì tới lượt thứ n micro im.
    context.close?.();
  }
}

/**
 * Đoạn thu có tiếng nói không?
 *
 * Bấm nhầm rồi thả ra ngay là chuyện thường xuyên với học sinh nhỏ. Không chặn ở
 * đây thì mỗi lần lỡ tay là một lần gọi API trả về chuỗi rỗng, và khung chat im
 * lặng không rõ vì sao.
 */
export function isTooShort(blob, milliseconds) {
  return milliseconds < 500 || blob.size < 2000;
}
