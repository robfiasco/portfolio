const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'icons');

const COLORS = {
  bgTop: [0x0b, 0x12, 0x20],
  bgBottom: [0x11, 0x18, 0x27],
  ink: [0xe2, 0xe8, 0xf0],
  mint: [0x14, 0xb8, 0xa6]
};

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function setPixel(data, width, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= width) return;
  const idx = (y * width + x) * 4;
  data[idx] = r;
  data[idx + 1] = g;
  data[idx + 2] = b;
  data[idx + 3] = a;
}

function drawCircle(data, width, cx, cy, radius, color) {
  const r2 = radius * radius;
  const x0 = Math.floor(cx - radius);
  const x1 = Math.ceil(cx + radius);
  const y0 = Math.floor(cy - radius);
  const y1 = Math.ceil(cy + radius);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        setPixel(data, width, x, y, color[0], color[1], color[2], 255);
      }
    }
  }
}

function drawLine(data, width, x1, y1, x2, y2, thickness, color) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let x = x1;
  let y = y1;
  const radius = Math.max(1, Math.floor(thickness / 2));

  while (true) {
    drawCircle(data, width, x, y, radius, color);
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function inRoundedRect(x, y, size, radius) {
  if (x >= radius && x < size - radius) return true;
  if (y >= radius && y < size - radius) return true;
  const rx = x < radius ? radius : size - radius - 1;
  const ry = y < radius ? radius : size - radius - 1;
  const dx = x - rx;
  const dy = y - ry;
  return dx * dx + dy * dy <= radius * radius;
}

function drawIcon(size) {
  const data = new Uint8Array(size * size * 4);
  const radius = Math.round(size * 0.22);

  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const r = lerp(COLORS.bgTop[0], COLORS.bgBottom[0], t);
    const g = lerp(COLORS.bgTop[1], COLORS.bgBottom[1], t);
    const b = lerp(COLORS.bgTop[2], COLORS.bgBottom[2], t);
    for (let x = 0; x < size; x++) {
      if (!inRoundedRect(x, y, size, radius)) continue;
      setPixel(data, size, x, y, r, g, b, 255);
    }
  }

  const dotRadius = Math.max(1, Math.round(size * 0.08));
  const dotX = Math.round(size * 0.31);
  const dotY = Math.round(size * 0.34);
  drawCircle(data, size, dotX, dotY, dotRadius, COLORS.mint);

  const stroke = Math.max(1, Math.round(size * 0.08));
  const scale = size / 64;
  const p = (v) => Math.round(v * scale);

  drawLine(data, size, p(22), p(30), p(30), p(36), stroke, COLORS.ink);
  drawLine(data, size, p(30), p(36), p(22), p(42), stroke, COLORS.ink);
  drawLine(data, size, p(34), p(42), p(44), p(42), stroke, COLORS.ink);

  return data;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function writePNG(filePath, size) {
  const rgba = Buffer.from(drawIcon(size));
  const png = encodePNG(size, size, rgba);
  fs.writeFileSync(filePath, png);
  return png;
}

function writeICO(filePath, pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + 16 * count;
  for (const png of pngs) {
    const size = png.size;
    const entry = Buffer.alloc(16);
    entry[0] = size === 256 ? 0 : size;
    entry[1] = size === 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.data.length;
    entries.push(entry);
  }

  const buffers = [header, ...entries, ...pngs.map(p => p.data)];
  fs.writeFileSync(filePath, Buffer.concat(buffers));
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const png16 = writePNG(path.join(OUT_DIR, 'favicon-16.png'), 16);
const png32 = writePNG(path.join(OUT_DIR, 'favicon-32.png'), 32);
writePNG(path.join(OUT_DIR, 'apple-touch-icon.png'), 180);

writeICO(path.join(OUT_DIR, 'favicon.ico'), [
  { size: 16, data: png16 },
  { size: 32, data: png32 }
]);

console.log('Icons generated in assets/icons');
