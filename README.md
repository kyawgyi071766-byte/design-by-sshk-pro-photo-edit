# Design By SSHK — Pro Photo Edit

AI photo/video editor with real Replicate inference, private Vercel Blob output persistence, Neon/Postgres job tracking, PWA support, and browser FFmpeg.wasm MP4 export.

Required Vercel environment variables: `REPLICATE_API_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `STORAGE_DATABASE_URL` (or `DATABASE_URL`). Optional `REPLICATE_MODEL` defaults to `black-forest-labs/flux-kontext-pro`.
