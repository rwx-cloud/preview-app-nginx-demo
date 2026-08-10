import http from 'node:http';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const port = 3000;
const bucket = process.env.S3_BUCKET ?? 'demo-bucket';
const objectKey = process.env.S3_OBJECT_KEY ?? 'hello.json';
const credentials = {
  accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
};

const internalS3 = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.MINIO_ENDPOINT ?? 'http://minio:9000',
  forcePathStyle: true,
  credentials,
});

function firstHeaderValue(value) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue?.split(',')[0].trim();
}

function publicOrigin(request) {
  const forwardedProtocol = firstHeaderValue(request.headers['x-forwarded-proto']);
  const protocol = forwardedProtocol === 'https' ? 'https' : 'http';
  const host = firstHeaderValue(request.headers['x-forwarded-host']) ?? request.headers.host;

  if (!host) throw new Error('The request did not include a public host');

  return new URL(`${protocol}://${host}`).origin;
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

async function initializeDemoObject() {
  try {
    await internalS3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await internalS3.send(new CreateBucketCommand({ Bucket: bucket }));
  }

  await internalS3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: 'application/json',
      Body: JSON.stringify(
        {
          message: 'Hello from MinIO!',
          proof: 'The browser fetched this object with a presigned URL routed through Nginx.',
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    }),
  );
}

await initializeDemoObject();

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') {
      writeJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'GET' && request.url === '/presigned-url') {
      const origin = publicOrigin(request);
      const publicS3 = new S3Client({
        region: 'us-east-1',
        endpoint: origin,
        forcePathStyle: true,
        credentials,
      });
      const expiresIn = 300;
      const url = await getSignedUrl(publicS3, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), { expiresIn });

      writeJson(response, 200, {
        url,
        origin,
        bucket,
        objectKey,
        expiresIn,
      });
      return;
    }

    writeJson(response, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    writeJson(response, 500, {
      error: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`API listening on port ${port}`);
});
