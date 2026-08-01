/**
 * Generates the PWA home-screen icons from the hero avatar already in
 * public/assets/emoji, so the installed app wears the same face as the game.
 *
 * Written against zlib directly rather than pulling in an image library: the
 * source is a plain 8-bit RGBA PNG, which is a few dozen lines to decode.
 *
 * Run with `npm run icons` after changing the source art.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'public/assets/emoji/avatar_cat.png')
const OUT_DIR = join(ROOT, 'public/assets/icons')

/** Cream page background, matching COLORS.pageBg. */
const BG = [255, 240, 245, 255]

function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  let offset = 8
  let width = 0
  let height = 0
  const idat = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) {
        throw new Error('only non-interlaced 8-bit RGBA is supported')
      }
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }

  const raw = inflateSync(Buffer.concat(idat))
  const bpp = 4
  const stride = width * bpp
  const pixels = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? pixels[y * stride + x - bpp] : 0
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0
      const c = x >= bpp && y > 0 ? pixels[(y - 1) * stride + x - bpp] : 0
      let value = line[x]
      if (filter === 1) value += a
      else if (filter === 2) value += b
      else if (filter === 3) value += (a + b) >> 1
      else if (filter === 4) {
        // Paeth: pick whichever neighbour the gradient predicts best.
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      } else if (filter !== 0) {
        throw new Error(`unsupported filter ${filter}`)
      }
      pixels[y * stride + x] = value & 0xff
    }
  }
  return { width, height, pixels }
}

function encodePng(width, height, pixels) {
  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // no filtering; the images are small
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length)
    out.writeUInt32BE(data.length, 0)
    out.write(type, 4, 'ascii')
    data.copy(out, 8)
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
    return out
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Bilinear sample, so scaling the 128px source up stays smooth. */
function sample(src, fx, fy) {
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(x0 + 1, src.width - 1)
  const y1 = Math.min(y0 + 1, src.height - 1)
  const tx = fx - x0
  const ty = fy - y0
  const out = [0, 0, 0, 0]
  for (let c = 0; c < 4; c++) {
    const p00 = src.pixels[(y0 * src.width + x0) * 4 + c]
    const p10 = src.pixels[(y0 * src.width + x1) * 4 + c]
    const p01 = src.pixels[(y1 * src.width + x0) * 4 + c]
    const p11 = src.pixels[(y1 * src.width + x1) * 4 + c]
    out[c] = p00 * (1 - tx) * (1 - ty) + p10 * tx * (1 - ty) + p01 * (1 - tx) * ty + p11 * tx * ty
  }
  return out
}

/**
 * Draws the avatar centred on the background at `inset` of the canvas.
 * Maskable icons need a wide safe zone because launchers crop them to a
 * circle or squircle, so they pass a smaller scale.
 */
function render(src, size, scale) {
  const pixels = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4] = BG[0]
    pixels[i * 4 + 1] = BG[1]
    pixels[i * 4 + 2] = BG[2]
    pixels[i * 4 + 3] = BG[3]
  }

  const drawn = Math.round(size * scale)
  const origin = Math.round((size - drawn) / 2)
  for (let y = 0; y < drawn; y++) {
    for (let x = 0; x < drawn; x++) {
      const [r, g, b, a] = sample(src, (x / drawn) * (src.width - 1), (y / drawn) * (src.height - 1))
      const alpha = a / 255
      if (alpha <= 0) continue
      const i = ((origin + y) * size + origin + x) * 4
      pixels[i] = Math.round(r * alpha + pixels[i] * (1 - alpha))
      pixels[i + 1] = Math.round(g * alpha + pixels[i + 1] * (1 - alpha))
      pixels[i + 2] = Math.round(b * alpha + pixels[i + 2] * (1 - alpha))
      pixels[i + 3] = 255
    }
  }
  return encodePng(size, size, pixels)
}

const source = decodePng(readFileSync(SOURCE))
const targets = [
  ['icon-192.png', 192, 0.78],
  ['icon-512.png', 512, 0.78],
  // Launchers crop maskable icons; keep the art inside the 80% safe zone.
  ['icon-maskable-512.png', 512, 0.56],
  ['apple-touch-icon.png', 180, 0.78],
]

for (const [name, size, scale] of targets) {
  const png = render(source, size, scale)
  writeFileSync(join(OUT_DIR, name), png)
  console.log(`${name}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`)
}
