import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ImageRendererService } from "../src/modules/translation/image-renderer.service.js";

describe("ImageRendererService", () => {
  it("keeps the source dimensions and creates a WebP overlay", async () => {
    const input = await sharp({ create: { width: 500, height: 240, channels: 3, background: "#f5f1e8" } }).jpeg().toBuffer();
    const output = await new ImageRendererService().render(input, [{ lineId: "line-1", text: "제주 말차 크림", translation: "济州抹茶奶油", confidence: 0.94, polygon: [[40, 80], [260, 80], [260, 120], [40, 120]] }]);
    const metadata = await sharp(output).metadata();
    expect(metadata).toMatchObject({ width: 500, height: 240, format: "webp" });
  }, 15_000);

  it("does not cover English-only or numeric OCR lines", async () => {
    const input = await sharp({ create: { width: 320, height: 160, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const output = await new ImageRendererService().render(input, [{ lineId: "line-2", text: "TALL 6.5", translation: "小杯 6.5", confidence: 0.99, polygon: [[20, 20], [200, 20], [200, 60], [20, 60]] }]);
    expect(Buffer.compare(await sharp(input).webp({ quality: 88 }).toBuffer(), output)).toBe(0);
  });

  it("wraps a long Chinese translation into the box without throwing", async () => {
    const input = await sharp({ create: { width: 360, height: 200, channels: 3, background: "#f5f1e8" } }).jpeg().toBuffer();
    const translation = "热美式咖啡中杯少冰请加一份浓缩和燕麦奶".repeat(2);
    const output = await new ImageRendererService().render(input, [{ lineId: "line-3", text: "아메리카노", translation, confidence: 0.9, polygon: [[20, 20], [300, 20], [300, 80], [20, 80]] }]);
    const metadata = await sharp(output).metadata();
    expect(metadata).toMatchObject({ width: 360, height: 200, format: "webp" });
  });

  it("marks low-confidence lines with a dashed border", async () => {
    const input = await sharp({ create: { width: 300, height: 160, channels: 3, background: "#f5f1e8" } }).jpeg().toBuffer();
    const region = { lineId: "line-4", text: "제주 말차 크림", translation: "济州抹茶奶油", polygon: [[40, 60], [260, 60], [260, 110], [40, 110]] as [[number, number], [number, number], [number, number], [number, number]] };
    const confident = await new ImageRendererService().render(input, [{ ...region, confidence: 0.95 }]);
    const uncertain = await new ImageRendererService().render(input, [{ ...region, confidence: 0.5 }]);
    expect(Buffer.compare(confident, uncertain)).not.toBe(0);
  });
});
