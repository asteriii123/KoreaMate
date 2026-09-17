import { Injectable, NotFoundException } from "@nestjs/common";
import { ImageAssetStatus, Prisma } from "@prisma/client";
import sharp from "sharp";
import type { Identity } from "../auth/identity.service.js";
import { PrismaService } from "../database/prisma.service.js";
import { ImageStorageService } from "./image-storage.service.js";

const MIME_FORMAT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

@Injectable()
export class ImageAssetsService {
  constructor(private readonly prisma: PrismaService, private readonly storage: ImageStorageService) {}

  async create(messageId: string, images: string[], identity: Identity): Promise<string[]> {
    const ids: string[] = [];
    for (const [index, dataUrl] of images.entries()) {
      const parsed = this.dataUrl(dataUrl);
      // Normalize EXIF orientation up front so OCR, the renderer and the stored
      // width/height all agree on the same pixel space. OpenCV (PaddleOCR) ignores
      // EXIF, so leaving the original orientation in place would misalign overlays.
      const oriented = await sharp(parsed.buffer, { limitInputPixels: 16_000_000 }).rotate().toBuffer();
      const metadata = await sharp(oriented).metadata();
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > 16_000_000) throw new Error("IMAGE_DIMENSIONS_INVALID");
      const id = crypto.randomUUID();
      const owner = identity.userId ? `users/${identity.userId}` : `guests/${identity.guestId}`;
      const key = `${owner}/${id}/original-${index}.${MIME_FORMAT[parsed.mimeType]}`;
      await this.storage.put(key, oriented, parsed.mimeType);
      await this.prisma.imageAsset.create({ data: { id, messageId, originalKey: key, mimeType: parsed.mimeType, width: metadata.width, height: metadata.height, expiresAt: identity.userId ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000) } });
      ids.push(id);
    }
    return ids;
  }

  async source(id: string): Promise<{ asset: { id: string; width: number; height: number }; buffer: Buffer }> {
    const asset = await this.prisma.imageAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException("Image asset not found");
    await this.prisma.imageAsset.update({ where: { id }, data: { status: ImageAssetStatus.PROCESSING } });
    return { asset, buffer: await this.storage.read(asset.originalKey) };
  }

  async complete(id: string, buffer: Buffer, regions: Prisma.InputJsonValue): Promise<void> {
    const asset = await this.prisma.imageAsset.findUniqueOrThrow({ where: { id } });
    const key = asset.originalKey.replace(/original-[^.]+\.[^.]+$/u, "translated.webp");
    await this.storage.put(key, buffer, "image/webp");
    await this.prisma.imageAsset.update({ where: { id }, data: { translatedKey: key, status: ImageAssetStatus.READY, regions, errorCode: null } });
  }

  async textOnly(id: string, regions: Prisma.InputJsonValue, errorCode: string): Promise<void> {
    await this.prisma.imageAsset.update({ where: { id }, data: { status: ImageAssetStatus.TEXT_ONLY, regions, errorCode } });
  }

  async fail(id: string, errorCode: string): Promise<void> {
    await this.prisma.imageAsset.update({ where: { id }, data: { status: ImageAssetStatus.FAILED, errorCode } });
  }

  async descriptor(id: string): Promise<{ id: string; status: "uploaded" | "processing" | "ready" | "text_only" | "failed"; originalUrl: string; translatedUrl: string | null; width: number; height: number }> {
    const asset = await this.prisma.imageAsset.findUniqueOrThrow({ where: { id } });
    const status = asset.status.toLowerCase() as "uploaded" | "processing" | "ready" | "text_only" | "failed";
    return { id, status, originalUrl: `/api/v1/image-assets/${id}/original`, translatedUrl: asset.translatedKey ? `/api/v1/image-assets/${id}/translated` : null, width: asset.width, height: asset.height };
  }

  async resolveForOwner(id: string, variant: "original" | "translated", identity: Identity): Promise<{ key: string; mimeType: string; signedUrl: string | null }> {
    const asset = await this.prisma.imageAsset.findFirst({ where: { id, message: { conversation: identity.userId ? { userId: identity.userId } : { guestId: identity.guestId ?? "00000000-0000-0000-0000-000000000000" } } } });
    if (!asset) throw new NotFoundException("Image asset not found");
    const key = variant === "translated" ? asset.translatedKey : asset.originalKey;
    if (!key) throw new NotFoundException("Translated image not available");
    return { key, mimeType: variant === "translated" ? "image/webp" : asset.mimeType, signedUrl: await this.storage.signedUrl(key, variant === "translated" ? "koreamate-translated.webp" : undefined) };
  }

  read(key: string): Promise<Buffer> { return this.storage.read(key); }

  async clearGuestExpiry(guestId: string): Promise<void> {
    const assets = await this.prisma.imageAsset.findMany({ where: { message: { conversation: { guestId } } }, select: { id: true } });
    if (assets.length) await this.prisma.imageAsset.updateMany({ where: { id: { in: assets.map(({ id }) => id) } }, data: { expiresAt: null } });
  }

  async cleanupExpired(): Promise<{ deleted: number }> {
    const assets = await this.prisma.imageAsset.findMany({ where: { expiresAt: { lt: new Date() } } });
    for (const asset of assets) { await this.storage.delete(asset.originalKey); await this.storage.delete(asset.translatedKey); }
    const result = await this.prisma.imageAsset.deleteMany({ where: { id: { in: assets.map(({ id }) => id) } } });
    return { deleted: result.count };
  }

  async deleteForConversation(conversationId: string): Promise<void> {
    const assets = await this.prisma.imageAsset.findMany({ where: { message: { conversationId } } });
    for (const asset of assets) { await this.storage.delete(asset.originalKey); await this.storage.delete(asset.translatedKey); }
  }

  private dataUrl(value: string): { mimeType: keyof typeof MIME_FORMAT; buffer: Buffer } {
    const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/u);
    if (!match || !(match[1]! in MIME_FORMAT)) throw new Error("IMAGE_FORMAT_INVALID");
    const buffer = Buffer.from(match[2]!, "base64");
    if (!buffer.length || buffer.length > 2_000_000) throw new Error("IMAGE_SIZE_INVALID");
    return { mimeType: match[1] as keyof typeof MIME_FORMAT, buffer };
  }
}
