import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const S3_BUCKET = process.env.S3_BUCKET?.trim();
const S3_REGION = process.env.S3_REGION?.trim();
const S3_ENDPOINT = process.env.S3_ENDPOINT?.trim();
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL?.trim().replace(/\/+$/, "");

function requireS3Env(): { bucket: string; region: string } {
  if (!S3_BUCKET || !S3_REGION) {
    throw new Error("S3_BUCKET and S3_REGION must be configured for uploads.");
  }
  return { bucket: S3_BUCKET, region: S3_REGION };
}

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const { region } = requireS3Env();
  s3Client = new S3Client({
    region,
    endpoint: S3_ENDPOINT || undefined,
    forcePathStyle: !!S3_ENDPOINT,
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
  return s3Client;
}

export async function generatePresignedUploadUrl(
  storageKey: string,
  contentType: string,
): Promise<{ uploadUrl: string; storageKey: string }> {
  const { bucket } = requireS3Env();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 60 * 5 });
  return { uploadUrl, storageKey };
}

export async function deleteS3Object(storageKey: string): Promise<void> {
  const { bucket } = requireS3Env();
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });
  await getS3Client().send(command);
}

export function getS3PublicUrl(storageKey: string): string {
  const { bucket, region } = requireS3Env();
  const normalizedKey = storageKey.replace(/^\/+/, "");
  if (S3_PUBLIC_URL) {
    return `${S3_PUBLIC_URL}/${normalizedKey}`;
  }
  if (S3_ENDPOINT) {
    const endpoint = S3_ENDPOINT.replace(/\/+$/, "");
    return `${endpoint}/${bucket}/${normalizedKey}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${normalizedKey}`;
}
