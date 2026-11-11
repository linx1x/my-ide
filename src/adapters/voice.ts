/**
 * Voice message transcription. Supports multiple providers to minimize API keys:
 *
 * 1. LOCAL (default, no API key) - Transformers.js + Whisper tiny, runs fully offline
 * 2. GROQ (optional, free tier) - Groq's Whisper API, very fast, needs GROQ_API_KEY
 * 3. OPENAI (optional, paid) - OpenAI Whisper, best quality, needs OPENAI_API_KEY
 *
 * Set VOICE_PROVIDER=local|groq|openai to override. Default: local (no keys).
 */
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import config from '../config.js';

type TranscriberFn = (audio: Float32Array | number[] | Int16Array, options: { chunk_length_s: number; stride_length_s: number }) => Promise<string | { text?: string }>;
let transcriber: TranscriberFn | null = null;

async function convertToWav(audioBuffer: Buffer, inputExt = 'ogg'): Promise<Buffer | null> {
  let ffmpegPath = 'ffmpeg';
  try {
    const ffmpegStatic = await import('ffmpeg-static');
    ffmpegPath = String(ffmpegStatic.default || ffmpegPath);
  } catch {
    /* use system ffmpeg */
  }

  const dir = await mkdtemp(join(tmpdir(), 'voice-'));
  const inputPath = join(dir, `audio.${inputExt}`);
  const outputPath = join(dir, 'audio.wav');

  try {
    const { spawn } = await import('node:child_process');
    await writeFile(inputPath, audioBuffer);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        ffmpegPath,
        ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', outputPath],
        { stdio: 'ignore' }
      );
      proc.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))
      );
    });

    return await readFile(outputPath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[Voice] FFmpeg conversion failed:', message);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Local transcription using Transformers.js + Whisper (no API key)
 */
function getInputExt(mimetype: string | undefined): string {
  if (mimetype?.includes('webm')) {return 'webm';}
  if (mimetype?.includes('ogg') || mimetype?.includes('opus')) {return 'ogg';}
  if (mimetype?.includes('mp3') || mimetype?.includes('mpeg')) {return 'mp3';}
  return 'ogg';
}

async function transcribeLocal(audioBuffer: Buffer, mimetype: string | undefined): Promise<string | null> {
  const needsConversion = !mimetype?.includes('wav');
  const wavBuffer = needsConversion
    ? await convertToWav(audioBuffer, getInputExt(mimetype))
    : audioBuffer;
  if (!wavBuffer) {return null;}

  try {
    if (!transcriber) {
      const { pipeline } = await import('@huggingface/transformers');
      transcriber = (await pipeline(
        'automatic-speech-recognition',
        config.whisperModel || 'Xenova/whisper-tiny.en',
      )) as TranscriberFn;
    }

    const wavefile = (await import('wavefile')).default;
    const wav = new wavefile.WaveFile(wavBuffer);
    wav.toBitDepth('32f');
    wav.toSampleRate(16000);
    let audioData = wav.getSamples();

    if (Array.isArray(audioData)) {
      if (audioData.length > 1) {
        const scale = Math.sqrt(2);
        for (let i = 0; i < audioData[0].length; i++) {
          audioData[0][i] = (scale * (audioData[0][i] + audioData[1][i])) / 2;
        }
      }
      audioData = audioData[0];
    }

    const output = await transcriber(audioData as any, {
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const text = typeof output === 'string' ? output : output?.text;
    return text?.trim() || null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[Voice] Local transcription failed:', message);
    return null;
  }
}

/**
 * Groq transcription (free tier, needs GROQ_API_KEY)
 */
async function transcribeGroq(audioBuffer: Buffer, mimetype: string | undefined): Promise<string | null> {
  const apiKey = config.groqApiKey;
  if (!apiKey) {return null;}

  try {
    const { default: Groq } = await import('groq-sdk' as string);
    const client = new Groq({ apiKey });

    const ext = mimetype?.includes('webm') ? 'webm'
      : mimetype?.includes('ogg') || mimetype?.includes('opus') ? 'ogg'
        : 'mp3';
    const file = new File([new Uint8Array(audioBuffer)], `audio.${ext}`, {
      type: mimetype || 'audio/ogg',
    });

    const result = await client.audio.transcriptions.create({
      model: 'whisper-large-v3-turbo',
      file,
      response_format: 'text',
    });
    return (typeof result === 'string' ? result : result?.text)?.trim() || null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[Voice] Groq transcription failed:', message);
    return null;
  }
}

/**
 * OpenAI transcription (paid, needs OPENAI_API_KEY)
 */
async function transcribeOpenAI(audioBuffer: Buffer, mimetype: string | undefined): Promise<string | null> {
  const apiKey = config.openaiApiKey;
  if (!apiKey) {return null;}

  let buffer = audioBuffer;
  let filename = 'audio.ogg';
  const needsConversion =
    mimetype?.includes('ogg') || mimetype?.includes('opus') || !mimetype;

  if (needsConversion) {
    const dir = await mkdtemp(join(tmpdir(), 'voice-'));
    try {
      const { spawn } = await import('node:child_process');
      let ffmpegPath = 'ffmpeg';
      try {
        const ffmpegStatic = await import('ffmpeg-static');
        ffmpegPath = String(ffmpegStatic.default || ffmpegPath);
      } catch {}

      const inputPath = join(dir, 'audio.ogg');
      const outputPath = join(dir, 'audio.mp3');
      await writeFile(inputPath, audioBuffer);

      await new Promise<void>((resolve, reject) => {
        const proc = spawn(
          ffmpegPath,
          ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', outputPath],
          { stdio: 'ignore' }
        );
        proc.on('close', (code) =>
          code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))
        );
      });
      buffer = await readFile(outputPath);
      filename = 'audio.mp3';
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  try {
    const { default: OpenAI } = await import('openai' as string);
    const client = new OpenAI({ apiKey });
    const file = new File([new Uint8Array(buffer)], filename, { type: 'audio/mpeg' });

    const result = await client.audio.transcriptions.create({
      file,
      model: config.whisperModel || 'whisper-1',
      response_format: 'text',
    });
    return (typeof result === 'string' ? result : result?.text)?.trim() || null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[Voice] OpenAI transcription failed:', message);
    return null;
  }
}

/**
 * Transcribe audio to text.
 * Priority: VOICE_PROVIDER (local|groq|openai). Default: local (no API key).
 * Falls back to other available providers on failure.
 * @param {Buffer} audioBuffer
 * @param {string} [mimetype]
 * @returns {Promise<string|null>}
 */
export async function transcribeVoice(audioBuffer: Buffer, mimetype = 'audio/ogg'): Promise<string | null> {
  if (!audioBuffer?.length) {return null;}

  const autoProvider = config.groqApiKey ? 'groq' : 'local';
  const provider = (config.voiceProvider || autoProvider).toLowerCase();
  const order =
    provider === 'groq'
      ? ['groq', 'local', 'openai']
      : provider === 'openai'
        ? ['openai', 'local', 'groq']
        : ['local', 'groq', 'openai'];

  for (const p of order) {
    try {
      const fn =
        p === 'local'
          ? transcribeLocal
          : p === 'groq'
            ? transcribeGroq
            : transcribeOpenAI;
      if (p === 'groq' && !config.groqApiKey) {continue;}
      if (p === 'openai' && !config.openaiApiKey) {continue;}

      const text = await fn(audioBuffer, mimetype);
      if (text) {return text;}
    } catch {
      /* try next */
    }
  }
  return null;
}
