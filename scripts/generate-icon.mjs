import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const size = 1024;
const pixels = new Uint8Array(size * size * 4);

const colors = {
  bg: [53, 102, 91, 255],
  bgDark: [31, 79, 69, 255],
  cream: [255, 253, 247, 255],
  ink: [25, 24, 22, 255],
  gold: [255, 193, 7, 255],
  transparent: [0, 0, 0, 0]
};

function setPixel(x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (Math.floor(y) * size + Math.floor(x)) * 4;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = color[3];
}

function fillRect(x, y, width, height, color) {
  for (let yy = y; yy < y + height; yy++) {
    for (let xx = x; xx < x + width; xx++) setPixel(xx, yy, color);
  }
}

function fillRoundedRect(x, y, width, height, radius, color) {
  const right = x + width;
  const bottom = y + height;

  for (let yy = y; yy < bottom; yy++) {
    for (let xx = x; xx < right; xx++) {
      const cx = xx < x + radius ? x + radius : xx >= right - radius ? right - radius - 1 : xx;
      const cy = yy < y + radius ? y + radius : yy >= bottom - radius ? bottom - radius - 1 : yy;
      const dx = xx - cx;
      const dy = yy - cy;

      if (dx * dx + dy * dy <= radius * radius) setPixel(xx, yy, color);
    }
  }
}

function fillCircle(cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let yy = cy - radius; yy <= cy + radius; yy++) {
    for (let xx = cx - radius; xx <= cx + radius; xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r2) setPixel(xx, yy, color);
    }
  }
}

function fillTriangle(points, color) {
  const [a, b, c] = points;
  const minX = Math.floor(Math.min(a[0], b[0], c[0]));
  const maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
  const minY = Math.floor(Math.min(a[1], b[1], c[1]));
  const maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
  const area = edge(a, b, c);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p = [x + 0.5, y + 0.5];
      const w0 = edge(b, c, p);
      const w1 = edge(c, a, p);
      const w2 = edge(a, b, p);

      if (
        (area >= 0 && w0 >= 0 && w1 >= 0 && w2 >= 0) ||
        (area < 0 && w0 <= 0 && w1 <= 0 && w2 <= 0)
      ) {
        setPixel(x, y, color);
      }
    }
  }
}

function edge(a, b, c) {
  return (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]);
}

function writePng(path) {
  const rowLength = size * 4 + 1;
  const raw = new Uint8Array(rowLength * size);

  for (let y = 0; y < size; y++) {
    raw[y * rowLength] = 0;
    raw.set(pixels.subarray(y * size * 4, (y + 1) * size * 4), y * rowLength + 1);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const chunks = [
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ];

  writeFileSync(path, Buffer.concat([signature, ...chunks]));
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

fillRect(0, 0, size, size, colors.transparent);
fillRoundedRect(80, 80, 864, 864, 190, colors.bg);
fillRoundedRect(80, 604, 864, 340, 190, colors.bgDark);
fillRoundedRect(204, 250, 616, 412, 58, colors.cream);
fillRoundedRect(246, 292, 532, 328, 34, colors.ink);
fillRoundedRect(278, 324, 104, 264, 18, colors.cream);
fillRoundedRect(642, 324, 104, 264, 18, colors.cream);
fillTriangle(
  [
    [458, 354],
    [458, 558],
    [612, 456]
  ],
  colors.gold
);
fillCircle(304, 736, 38, colors.cream);
fillCircle(512, 736, 38, colors.cream);
fillCircle(720, 736, 38, colors.cream);

writePng("src-tauri/icons/icon.png");
