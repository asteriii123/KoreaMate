import { Injectable } from "@nestjs/common";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

@Injectable()
export class ImageStorageService {
  private readonly bucket = process.env.R2_BUCKET ?? "";
  private readonly local = process.env.NODE_ENV !== "production" && !process.env.R2_ENDPOINT;
  private readonly localRoot = resolve(process.cwd(), "../.data-image-assets");
  private readonly s3 = this.local ? null : new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY ? { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } : undefined,
  });

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.local) {
      const path = this.localPath(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
      return;
    }
    this.assertConfigured();
    await this.s3!.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async read(key: string): Promise<Buffer> {
    if (this.local) return readFile(this.localPath(key));
    this.assertConfigured();
    const result = await this.s3!.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await result.Body!.transformToByteArray());
  }

  async signedUrl(key: string, downloadName?: string): Promise<string | null> {
    if (this.local) return null;
    this.assertConfigured();
    return getSignedUrl(this.s3!, new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: downloadName ? `attachment; filename="${downloadName}"` : undefined }), { expiresIn: 300 });
  }

  async delete(key: string | null): Promise<void> {
    if (!key) return;
    if (this.local) { await rm(this.localPath(key), { force: true }); return; }
    this.assertConfigured();
    await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private assertConfigured(): void {
    if (!this.s3 || !this.bucket || !process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) throw new Error("IMAGE_STORAGE_NOT_CONFIGURED");
  }

  private localPath(key: string): string {
    return resolve(this.localRoot, ...key.split("/"));
  }
}
