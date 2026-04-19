#!/usr/bin/env node
/**
 * SkyStock FPV — Batch Upload Tool
 *
 * Scans a folder for MP4 files, auto-generates watermarked previews
 * and thumbnails via ffmpeg, then uploads everything to SkyStock.
 *
 * Usage:
 *   node scripts/upload.mjs ./my-exports
 *   node scripts/upload.mjs ./my-exports --auto   # skip prompts, use filename as title
 *
 * Requirements:
 *   - ffmpeg + ffprobe installed (brew install ffmpeg / apt install ffmpeg)
 *   - SKYSTOCK_API_KEY env var set (or in .env)
 *   - SKYSTOCK_URL env var set (defaults to https://skystock.pages.dev)
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, createReadStream } from 'fs';
import { join, basename, extname, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

// ── Config ──────────────────────────────────────────────────────────
const SITE_URL = process.env.SKYSTOCK_URL || 'https://skystock.pages.dev';
const API_KEY = process.env.SKYSTOCK_API_KEY || '';
const API = `${SITE_URL}/api`;

// Load .env from project root if present
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPath = join(__dirname, '..', '.env.upload');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const [k, ...v] = line.split('=');
      if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
    }
  }
} catch {}

const apiKey = process.env.SKYSTOCK_API_KEY || API_KEY;
const siteUrl = process.env.SKYSTOCK_URL || SITE_URL;

if (!apiKey) {
  console.error('\n❌ SKYSTOCK_API_KEY not set.');
  console.error('   Set it in your environment or create .env.upload in project root:\n');
  console.error('   SKYSTOCK_API_KEY=your-secret-key-here');
  console.error('   SKYSTOCK_URL=https://skystock.pages.dev\n');
  process.exit(1);
}

// ── Helpers ─────────────────────────────────────────────────────────

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function parseFraction(s) {
  if (!s) return 0;
  const [num, den] = String(s).split('/').map(Number);
  return den ? num / den : num;
}

function ffprobe(file) {
  const raw = run(
    `ffprobe -v quiet -print_format json -show_format -show_streams "${file}"`
  );
  return JSON.parse(raw);
}

function ask(question, defaultVal = '') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultVal ? ` [${defaultVal}]` : '';
  return new Promise((res) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      rl.close();
      res(answer.trim() || defaultVal);
    });
  });
}

async function apiRequest(path, opts = {}) {
  const url = `${siteUrl}/api${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

async function uploadFile(videoId, filePath, type) {
  const filename = basename(filePath);
  const ext = extname(filePath).slice(1).toLowerCase();
  const contentType = type === 'thumbnail'
    ? (ext === 'png' ? 'image/png' : 'image/jpeg')
    : (ext === 'mov' ? 'video/quicktime' : 'video/mp4');
  const fileSize = statSync(filePath).size;

  // Step 1: Ask worker for a presigned R2 URL
  const { uploadUrl, key, contentType: signedCt } = await apiRequest(
    `/admin/videos/${videoId}/upload-url`,
    {
      method: 'POST',
      body: JSON.stringify({ type, filename, contentType, size: fileSize }),
    }
  );

  // Step 2: PUT directly to R2 via presigned URL (bypasses worker entirely)
  // Stream the body so 4K/multi-GB files don't blow Node's buffer cap.
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': signedCt || contentType,
      'Content-Length': String(fileSize),
    },
    body: createReadStream(filePath),
    duplex: 'half',
  });

  if (!putRes.ok) {
    const body = await putRes.text();
    throw new Error(`R2 upload failed (${type}): ${putRes.status} ${body}`);
  }

  // Step 3: Tell worker to record the key in D1
  return apiRequest(`/admin/videos/${videoId}/confirm-upload`, {
    method: 'POST',
    body: JSON.stringify({ type, key }),
  });
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function titleFromFilename(name) {
  return name
    .replace(extname(name), '')
    .replace(/[-_]/g, ' ')
    .replace(/DJI\s?\d+/gi, '')
    .replace(/\d{8,}/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled FPV Footage';
}

// ── Video Processing ────────────────────────────────────────────────

function getVideoInfo(file) {
  const info = ffprobe(file);
  const videoStream = info.streams.find((s) => s.codec_type === 'video');
  const audioStream = info.streams.find((s) => s.codec_type === 'audio');

  const width = videoStream?.width || 0;
  const height = videoStream?.height || 0;
  const fps = parseFraction(videoStream?.r_frame_rate) || 30;
  const duration = parseFloat(info.format?.duration || '0');
  const fileSize = parseInt(info.format?.size || '0');

  let resolution = '1080p';
  if (width >= 3840 || height >= 2160) resolution = '4K';
  else if (width >= 2560 || height >= 1440) resolution = '2.7K';

  return { width, height, fps: Math.round(fps), duration, fileSize, resolution };
}

function generateThumbnail(inputFile, outputFile, duration) {
  const seekTo = Math.max(1, Math.floor(duration * 0.3));
  run(
    `ffmpeg -y -ss ${seekTo} -i "${inputFile}" -vframes 1 -q:v 2 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" "${outputFile}"`
  );
  console.log('    ✅ Thumbnail generated');
}

function generateWatermarkedPreview(inputFile, outputFile, duration) {
  const previewDuration = Math.min(15, duration);
  const startTime = Math.max(0, Math.floor((duration - previewDuration) * 0.3));

  const watermarkFilter = [
    `drawtext=text='SKYSTOCK FPV':fontsize=72:fontcolor=white@0.15:x=(w-tw)/2:y=(h-th)/2:font=Arial`,
    `drawtext=text='PREVIEW':fontsize=28:fontcolor=white@0.2:x=30:y=30:font=Arial`,
    `drawtext=text='skystock.pages.dev':fontsize=24:fontcolor=white@0.2:x=w-tw-30:y=h-th-30:font=Arial`,
  ].join(',');

  run(
    `ffmpeg -y -ss ${startTime} -i "${inputFile}" -t ${previewDuration} -vf "${watermarkFilter}" -c:v libx264 -preset fast -crf 28 -c:a aac -b:a 128k -movflags +faststart "${outputFile}"`
  );
  console.log('    ✅ Watermarked preview generated');
}

// ── Main ────────────────────────────────────────────────────────────

async function processVideo(file, outputDir, autoMode) {
  const name = basename(file);
  const info = getVideoInfo(file);

  console.log(`\n┌─────────────────────────────────────────────`);
  console.log(`│ 📹 ${name}`);
  console.log(`│    ${info.resolution} · ${info.fps}fps · ${Math.floor(info.duration)}s · ${formatBytes(info.fileSize)}`);
  console.log(`└─────────────────────────────────────────────`);

  let title, description, location, tags, price, status;

  if (autoMode) {
    title = titleFromFilename(name);
    description = `FPV drone footage shot on DJI Avata 360. ${info.resolution} at ${info.fps}fps.`;
    location = 'Central QLD';
    tags = 'fpv,drone,aerial,avata360';
    price = '29.99';
    status = 'draft';
  } else {
    title = await ask('Title', titleFromFilename(name));
    description = await ask('Description', `FPV drone footage. ${info.resolution} at ${info.fps}fps.`);
    location = await ask('Location', 'Central QLD');
    tags = await ask('Tags (comma sep)', 'fpv,drone,aerial');
    price = await ask('Price AUD', '29.99');
    const pubChoice = await ask('Publish immediately? (y/n)', 'n');
    status = pubChoice.toLowerCase() === 'y' ? 'published' : 'draft';
  }

  const thumbPath = join(outputDir, `${basename(name, extname(name))}_thumb.jpg`);
  const previewPath = join(outputDir, `${basename(name, extname(name))}_preview.mp4`);

  console.log('\n  🎬 Generating assets...');
  generateThumbnail(file, thumbPath, info.duration);
  generateWatermarkedPreview(file, previewPath, info.duration);

  console.log('\n  ☁️  Creating video record...');
  const video = await apiRequest('/admin/videos', {
    method: 'POST',
    body: JSON.stringify({
      title, description, location,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      price_cents: Math.round(parseFloat(price) * 100),
      resolution: info.resolution, fps: info.fps,
      duration_seconds: Math.round(info.duration),
      file_size_bytes: info.fileSize, status,
    }),
  });

  console.log(`    ✅ Video record created: ${video.id}`);
  console.log('\n  📤 Uploading files...');

  process.stdout.write('    Original... ');
  await uploadFile(video.id, file, 'original');
  console.log('✅');

  process.stdout.write('    Preview...  ');
  await uploadFile(video.id, previewPath, 'preview');
  console.log('✅');

  process.stdout.write('    Thumbnail.. ');
  await uploadFile(video.id, thumbPath, 'thumbnail');
  console.log('✅');

  console.log(`\n  🎉 Done! ${status === 'published' ? '🟢 Published' : '🟡 Saved as draft'}`);
  console.log(`     View: ${siteUrl}/video/${video.id}`);

  return video;
}

async function main() {
  const args = process.argv.slice(2);
  const autoMode = args.includes('--auto');
  const inputDir = args.find((a) => !a.startsWith('--'));

  if (!inputDir) {
    console.log(`\n  SkyStock FPV — Batch Upload Tool\n\n  Usage:\n    node scripts/upload.mjs <folder>\n    node scripts/upload.mjs <folder> --auto\n\n  Options:\n    --auto   Skip prompts, use defaults\n\n  Env vars:\n    SKYSTOCK_API_KEY  Your upload API key\n    SKYSTOCK_URL      Site URL (optional)\n\n  Requires: ffmpeg, ffprobe\n`);
    process.exit(0);
  }

  try {
    run('ffmpeg -version');
    run('ffprobe -version');
  } catch {
    console.error('❌ ffmpeg/ffprobe not found. Install: https://ffmpeg.org/download.html (winget install ffmpeg / brew install ffmpeg / apt install ffmpeg)');
    process.exit(1);
  }

  const dir = resolve(inputDir);
  if (!existsSync(dir)) {
    console.error(`❌ Directory not found: ${dir}`);
    process.exit(1);
  }

  const files = readdirSync(dir)
    .filter((f) => /\.(mp4|mov|MP4|MOV)$/i.test(f))
    .map((f) => join(dir, f))
    .sort();

  if (files.length === 0) {
    console.error(`❌ No MP4/MOV files found in: ${dir}`);
    process.exit(1);
  }

  console.log(`\n🎥 SkyStock FPV — Batch Upload`);
  console.log(`   Found ${files.length} video(s) in ${dir}`);
  console.log(`   Uploading to ${siteUrl}\n`);

  const outputDir = join(dir, '.skystock-temp');
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const results = [];
  for (const file of files) {
    try {
      const video = await processVideo(file, outputDir, autoMode);
      results.push({ file: basename(file), id: video.id, status: 'ok' });
    } catch (err) {
      console.error(`\n  ❌ Failed: ${err.message}`);
      results.push({ file: basename(file), status: 'error', error: err.message });
    }
  }

  console.log('\n  Upload Summary');
  const ok = results.filter((r) => r.status === 'ok');
  const failed = results.filter((r) => r.status === 'error');
  console.log(`  ✅ Uploaded: ${ok.length}`);
  if (failed.length) console.log(`  ❌ Failed:   ${failed.length}`);
  for (const r of ok) {
    console.log(`     • ${r.file} → ${siteUrl}/video/${r.id}`);
  }
  for (const r of failed) {
    console.log(`     ✗ ${r.file}: ${r.error}`);
  }
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
