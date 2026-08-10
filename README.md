# RWX preview app with Nginx and MinIO

This demo shows how one RWX app task can run a small preview environment.

RWX prepares the environment in separate cached tasks:

- installs the Node runtime and API dependencies;
- installs Nginx; and
- downloads a pinned MinIO binary and verifies its checksum.

The app task starts MinIO and the API as ordered background processes, waits for their readiness checks, and then runs Nginx as the public app process. Nginx serves the UI and routes API and object requests through the same RWX app URL, so all three processes share one idle timer and lifecycle.

## Run it

```bash
rwx run .rwx/demo.yml --open
```

## Request flow

```text
browser ──GET /api/presigned-url──> Nginx ──> API
   │                                           │
   │                         signs the public Nginx origin
   │                                           │
   └──GET /demo-bucket/hello.json?...──────────┘
                         │
                      Nginx ──> MinIO
```

The API signs the public Nginx origin using path-style S3 URLs. Nginx routes the real `demo-bucket` path to MinIO without changing the host, path, or query string, allowing MinIO to validate the signature.

This project pins a legacy MinIO Community binary for demo purposes. MinIO Community is now source-only; build a current MinIO release from source or use a maintained object-store distribution for production.
