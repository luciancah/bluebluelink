import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const outputDir = resolve(import.meta.dirname, "../public/icons");

generateIcon("icon-192.png", 192, false);
generateIcon("icon-512.png", 512, false);
generateIcon("maskable-icon-512.png", 512, true);

function generateIcon(fileName, size, maskable) {
  const data = renderIcon(size, maskable);
  const path = resolve(outputDir, fileName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(size, size, data));
}

function renderIcon(size, maskable) {
  const pixels = new Uint8Array(size * size * 4);
  fill(pixels, size, 0, 0, size, size, [37, 99, 235, 255]);

  if (maskable) {
    fillCircle(pixels, size, size / 2, size / 2, size * 0.37, [29, 78, 216, 255]);
  }

  const scale = size / 512;
  fillRoundedRect(pixels, size, 99 * scale, 178 * scale, 314 * scale, 122 * scale, 28 * scale, [
    255, 255, 255, 255,
  ]);
  fillPolygon(
    pixels,
    size,
    [
      [142 * scale, 214 * scale],
      [181 * scale, 151 * scale],
      [264 * scale, 151 * scale],
      [313 * scale, 214 * scale],
    ],
    [255, 255, 255, 255],
  );
  fillPolygon(
    pixels,
    size,
    [
      [180 * scale, 182 * scale],
      [246 * scale, 182 * scale],
      [275 * scale, 216 * scale],
      [158 * scale, 216 * scale],
    ],
    [191, 219, 254, 255],
  );
  fillCircle(pixels, size, 177 * scale, 305 * scale, 45 * scale, [255, 255, 255, 255]);
  fillCircle(pixels, size, 177 * scale, 305 * scale, 21 * scale, [37, 99, 235, 255]);
  fillCircle(pixels, size, 354 * scale, 305 * scale, 45 * scale, [255, 255, 255, 255]);
  fillCircle(pixels, size, 354 * scale, 305 * scale, 21 * scale, [37, 99, 235, 255]);

  if (!maskable) {
    strokeCircleArc(pixels, size, 389 * scale, 220 * scale, 46 * scale, -1.2, 0.15, 22 * scale, [
      191, 219, 254, 255,
    ]);
    strokeCircleArc(pixels, size, 419 * scale, 220 * scale, 75 * scale, -1.25, 0.1, 22 * scale, [
      191, 219, 254, 255,
    ]);
  }

  return pixels;
}

function fill(pixels, width, x, y, rectWidth, rectHeight, color) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(width, Math.ceil(x + rectWidth));
  const bottom = Math.min(width, Math.ceil(y + rectHeight));

  for (let row = top; row < bottom; row += 1) {
    for (let column = left; column < right; column += 1) {
      setPixel(pixels, width, column, row, color);
    }
  }
}

function fillRoundedRect(pixels, width, x, y, rectWidth, rectHeight, radius, color) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(width, Math.ceil(x + rectWidth));
  const bottom = Math.min(width, Math.ceil(y + rectHeight));

  for (let row = top; row < bottom; row += 1) {
    for (let column = left; column < right; column += 1) {
      const dx = Math.max(x + radius - column, 0, column - (x + rectWidth - radius));
      const dy = Math.max(y + radius - row, 0, row - (y + rectHeight - radius));
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(pixels, width, column, row, color);
      }
    }
  }
}

function fillCircle(pixels, width, centerX, centerY, radius, color) {
  const left = Math.max(0, Math.floor(centerX - radius));
  const top = Math.max(0, Math.floor(centerY - radius));
  const right = Math.min(width, Math.ceil(centerX + radius));
  const bottom = Math.min(width, Math.ceil(centerY + radius));
  const radiusSquared = radius * radius;

  for (let row = top; row < bottom; row += 1) {
    for (let column = left; column < right; column += 1) {
      const dx = column - centerX;
      const dy = row - centerY;
      if (dx * dx + dy * dy <= radiusSquared) {
        setPixel(pixels, width, column, row, color);
      }
    }
  }
}

function fillPolygon(pixels, width, points, color) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point[1]))));
  const maxY = Math.min(width, Math.ceil(Math.max(...points.map((point) => point[1]))));

  for (let y = minY; y <= maxY; y += 1) {
    const intersections = [];
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      if ((current[1] <= y && next[1] > y) || (next[1] <= y && current[1] > y)) {
        const x = current[0] + ((y - current[1]) * (next[0] - current[0])) / (next[1] - current[1]);
        intersections.push(x);
      }
    }

    intersections.sort((left, right) => left - right);
    for (let index = 0; index < intersections.length; index += 2) {
      fill(pixels, width, intersections[index], y, intersections[index + 1] - intersections[index], 1, color);
    }
  }
}

function strokeCircleArc(pixels, width, centerX, centerY, radius, start, end, strokeWidth, color) {
  const steps = Math.ceil(radius * 2.2);
  for (let step = 0; step <= steps; step += 1) {
    const t = start + ((end - start) * step) / steps;
    fillCircle(
      pixels,
      width,
      centerX + Math.cos(t) * radius,
      centerY + Math.sin(t) * radius,
      strokeWidth / 2,
      color,
    );
  }
}

function setPixel(pixels, width, x, y, color) {
  const index = (y * width + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const scanlines = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const sourceStart = y * width * 4;
    const targetStart = y * (width * 4 + 1);
    scanlines[targetStart] = 0;
    Buffer.from(rgba.buffer, sourceStart, width * 4).copy(scanlines, targetStart + 1);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", createHeader(width, height)),
    chunk("IDAT", deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function createHeader(width, height) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;
  return buffer;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
