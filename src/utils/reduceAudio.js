import ffmpeg from 'fluent-ffmpeg';
import streamifier from 'streamifier';
import getStream from 'get-stream';

export async function reduceAudioBuffer(inputBuffer, options = {}) {
  const {
    maxSizeMB = 24,
    bitrate = '64k',
    convertToMp3 = true,
  } = options;

  const inputStream = streamifier.createReadStream(inputBuffer);
  const outputChunks = [];

  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputStream)
      .format(convertToMp3 ? 'mp3' : 'wav') // or whatever format you need
      .audioBitrate(bitrate)
      .on('error', reject)
      .on('end', async () => {
        const outputBuffer = Buffer.concat(outputChunks);
        if (outputBuffer.length > maxSizeMB * 1024 * 1024) {
          return reject(new Error('File size exceeds maximum allowed size'));
        }
        resolve(outputBuffer);
      })
      .pipe()
      .on('data', chunk => outputChunks.push(chunk));
  });
}