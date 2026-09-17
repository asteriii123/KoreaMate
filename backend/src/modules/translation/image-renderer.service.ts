import { Injectable } from "@nestjs/common";
import sharp from "sharp";
import type { OcrResult } from "./paddle-ocr.provider.js";

export type RenderRegion = OcrResult["lines"][number] & { translation: string };

@Injectable()
export class ImageRendererService {
  async render(input: Buffer, regions: RenderRegion[]): Promise<Buffer> {
    const image = sharp(input, { limitInputPixels: 16_000_000 }).rotate();
    const metadata = await image.metadata();
    const width = metadata.width ?? 1;
    const height = metadata.height ?? 1;
    const raw = await image.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const overlays: string[] = [];
    for (const region of regions) {
      if (!/[가-힣]/u.test(region.text) || region.translation.trim() === region.text.trim()) continue;
      const xs = region.polygon.map(([x]) => x);
      const ys = region.polygon.map(([, y]) => y);
      const left = Math.max(0, Math.floor(Math.min(...xs)));
      const top = Math.max(0, Math.floor(Math.min(...ys)));
      const boxWidth = Math.max(8, Math.ceil(Math.max(...xs) - left));
      const boxHeight = Math.max(8, Math.ceil(Math.max(...ys) - top));
      const rgb = this.background(raw.data, raw.info.channels, width, height, left, top, boxWidth, boxHeight);
      const fill = `rgb(${rgb[0] ?? 245},${rgb[1] ?? 245},${rgb[2] ?? 245})`;
      const luminance = (rgb[0] ?? 245) * .299 + (rgb[1] ?? 245) * .587 + (rgb[2] ?? 245) * .114;
      const color = luminance > 145 ? "#111827" : "#ffffff";
      const { lines, fontSize } = this.layout(region.translation, boxWidth, boxHeight);
      const dash = region.confidence < .65 ? ' stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4 3"' : "";
      const centerX = left + boxWidth / 2;
      const lineHeight = fontSize * 1.22;
      const totalHeight = lines.length * lineHeight;
      const firstBaseline = top + (boxHeight - totalHeight) / 2 + fontSize * 0.82;
      overlays.push(`<rect x="${left}" y="${top}" width="${boxWidth}" height="${boxHeight}" rx="2" fill="${fill}"${dash}/>`);
      lines.forEach((line, index) => {
        overlays.push(`<text x="${centerX}" y="${firstBaseline + index * lineHeight}" text-anchor="middle" font-family="'Noto Sans CJK SC','Microsoft YaHei',sans-serif" font-size="${fontSize}" font-weight="600" fill="${color}">${this.escape(line)}</text>`);
      });
    }
    const svg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${overlays.join("")}</svg>`);
    return image.composite([{ input: svg }]).webp({ quality: 88 }).toBuffer();
  }

  private layout(text: string, boxWidth: number, boxHeight: number): { lines: string[]; fontSize: number } {
    for (let fontSize = Math.max(10, Math.floor(boxHeight * 0.72)); fontSize >= 10; fontSize -= 1) {
      const lines = this.wrap(text, (boxWidth * 0.94) / fontSize);
      if (lines.length * fontSize * 1.22 <= boxHeight * 0.92) return { lines, fontSize };
    }
    const lines = this.wrap(text, (boxWidth * 0.94) / 10);
    const maxLines = Math.max(1, Math.floor(boxHeight / 14));
    if (lines.length <= maxLines) return { lines, fontSize: 10 };
    const clipped = lines.slice(0, maxLines);
    const last = clipped[maxLines - 1]!;
    clipped[maxLines - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : "…";
    return { lines: clipped, fontSize: 10 };
  }

  private wrap(text: string, maxEm: number): string[] {
    const lines: string[] = [];
    let current = "";
    let currentEm = 0;
    for (const character of Array.from(text)) {
      const width = this.charEm(character);
      if (current && currentEm + width > maxEm) {
        lines.push(current);
        current = character;
        currentEm = width;
      } else {
        current += character;
        currentEm += width;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  private charEm(character: string): number {
    if (character === " ") return 0.34;
    const code = character.codePointAt(0) ?? 0;
    const fullWidth = (code >= 0x2e80 && code <= 0x9fff)
      || (code >= 0xac00 && code <= 0xd7af)
      || (code >= 0x3000 && code <= 0x303f)
      || (code >= 0x3040 && code <= 0x30ff)
      || (code >= 0xf900 && code <= 0xfaff)
      || (code >= 0xff00 && code <= 0xffef);
    return fullWidth ? 1.0 : 0.56;
  }

  private escape(value: string): string {
    return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");
  }

  private background(data: Buffer, channels: number, imageWidth: number, imageHeight: number, left: number, top: number, boxWidth: number, boxHeight: number): number[] {
    const sums = [0, 0, 0];
    let count = 0;
    const step = Math.max(1, Math.floor(Math.min(boxWidth, boxHeight) / 8));
    for (let y = Math.max(0, top); y < Math.min(imageHeight, top + boxHeight); y += step) {
      for (let x = Math.max(0, left); x < Math.min(imageWidth, left + boxWidth); x += step) {
        if (x > left + step && x < left + boxWidth - step && y > top + step && y < top + boxHeight - step) continue;
        const offset = (y * imageWidth + x) * channels;
        for (let channel = 0; channel < 3; channel += 1) sums[channel]! += data[offset + channel] ?? 245;
        count += 1;
      }
    }
    return sums.map((value) => Math.round(value / Math.max(1, count)));
  }
}
