// Self-hosted storage via DigitalOcean Spaces (S3-compatible)
// Drop-in replacement for Manus Forge storage. Same export signatures.
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const endpoint = process.env.SPACES_ENDPOINT ?? "";
const region = process.env.SPACES_REGION ?? "sgp1";
const bucket = process.env.SPACES_BUCKET ?? "";
const accessKeyId = process.env.SPACES_KEY ?? "";
const secretAccessKey = process.env.SPACES_SECRET ?? "";
const publicBase = (process.env.SPACES_PUBLIC_BASE ?? "").replace(/\/+$/, "");

function client(): S3Client {
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Storage config missing: set SPACES_ENDPOINT, SPACES_BUCKET, SPACES_KEY, SPACES_SECRET",
    );
  }
  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function publicUrl(key: string): string {
  return publicBase ? `${publicBase}/${key}` : `${endpoint}/${bucket}/${key}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const body: Buffer =
    typeof data === "string" ? Buffer.from(data) : Buffer.from(data as Uint8Array);

  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read",
    }),
  );

  return { key, url: publicUrl(key) };
}

export async function storageGet(
  relKey: string,
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: publicUrl(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client(), cmd, { expiresIn: 3600 });
}
