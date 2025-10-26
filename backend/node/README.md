# Backend Node.js (Fastify)

REST API + WebSocket server for the BIM Interoperability System.

## Overview

This backend handles:
- File upload and validation
- Conversion orchestration (Revit, Archicad, IFC)
- Communication with Autodesk Forge/APS
- Communication with Python bridge (Archicad integration)
- WebSocket bridge for real-time progress updates
- Job management and cleanup

## Tech Stack

```json
{
  "fastify": "5.6.1",
  "typescript": "5.9.3",
  "zod": "4.1.12",
  "@fastify/websocket": "11.2.0",
  "@fastify/multipart": "9.2.1",
  "@fastify/cors": "11.1.0",
  "@aps_sdk/authentication": "1.0.0",
  "@aps_sdk/model-derivative": "1.2.0",
  "axios": "1.12.2"
}
```

## Project Structure

```
backend/node/
├── src/
│   ├── server.ts              # Entry point
│   ├── app.ts                 # Fastify app configuration
│   ├── routes/
│   │   ├── model.route.ts     # Conversion endpoints
│   │   ├── health.route.ts    # Health check
│   │   └── websocket.route.ts # WebSocket handlers
│   ├── services/
│   │   ├── forge.service.ts   # Autodesk Forge/APS integration
│   │   ├── python.service.ts  # Python bridge communication
│   │   ├── job.service.ts     # Job management
│   │   └── cleanup.service.ts # Automatic job cleanup
│   ├── schemas/
│   │   ├── model.schema.ts    # Zod validation schemas
│   │   └── job.schema.ts      # Job-related schemas
│   ├── types/
│   │   ├── job.types.ts       # Job TypeScript types
│   │   └── conversion.types.ts # Conversion types
│   └── utils/
│       ├── logger.ts          # Logging utilities
│       └── storage.ts         # File storage helpers
├── dist/                      # Compiled JavaScript (after build)
├── package.json
├── tsconfig.json
└── README.md                  # This file
```

## Key Features

### 1. RESTful API with Swagger Documentation

```typescript
// Available at: http://localhost:3000/docs
```

Endpoints:
- `POST /models/generate-ifc` - Convert Revit/Archicad to IFC
- `POST /models/convert-from-ifc` - Convert IFC to Revit/Archicad
- `GET /models/jobs/:jobId` - Get job status
- `DELETE /models/jobs/:jobId` - Cancel job
- `GET /health` - Health check (services status)

### 2. WebSocket for Real-Time Progress

```typescript
// Connect to: ws://localhost:3000/models/ws/conversion

// Client sends:
{
  "type": "subscribe",
  "jobId": "job-123456"
}

// Server broadcasts:
{
  "type": "progress",
  "jobId": "job-123456",
  "status": "processing",
  "progress": 45,
  "message": "Converting to IFC...",
  "details": {
    "plugin": "revit",
    "currentStep": "upload"
  }
}
```

### 3. Job Management

- Automatic job ID generation
- Job state persistence (in-memory)
- TTL-based cleanup (configurable, default 3 hours)
- Cancel support for long-running jobs

### 4. Autodesk Forge Integration

Handles:
- OAuth authentication
- File upload to OSS bucket
- Model Derivative API (conversion jobs)
- Progress monitoring
- Result download

### 5. Python Bridge Communication

HTTP proxy to Python service for:
- Archicad plugin communication
- `.pln` to `.ifc` conversion
- Plugin status monitoring

### 6. Multi-format Support

| Source | Target | Method |
|--------|--------|--------|
| `.rvt` | `.ifc` | Forge/APS (cloud) |
| `.pln` | `.ifc` | Python + Archicad Plugin |
| `.ifc` | `.rvt` | Revit Plugin (WebSocket) |
| `.ifc` | `.pln` | Python + Archicad Plugin |

## Environment Variables

Create a `.env` file in `backend/node/`:

```env
# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# CORS
CORS_ORIGINS=http://localhost:3001,http://localhost:5173

# Python Bridge
PYTHON_SERVICE_HOST=localhost
PYTHON_SERVICE_PORT=5000

# Autodesk Forge/APS
FORGE_CLIENT_ID=your_client_id
FORGE_CLIENT_SECRET=your_client_secret
FORGE_BUCKET_KEY=bim-interop-bucket

# Job Management
JOB_STORAGE_ROOT=./storage
JOB_TTL_MINUTES=180
JOB_CLEANUP_INTERVAL_SECONDS=60

# Revit Plugin WebSocket
REVIT_PLUGIN_WS_URL=ws://localhost:8082

# Archicad Plugin WebSocket (future)
ARCHICAD_PLUGIN_WS_URL=ws://localhost:8081

# Logging
LOG_LEVEL=info
```

## Development

### Install Dependencies

```bash
pnpm install
```

### Run in Development Mode

```bash
pnpm dev
```

Server starts at: **http://localhost:3000**

Hot-reload enabled via `tsx watch`.

### API Documentation

Access interactive API docs:
- **Swagger UI**: http://localhost:3000/docs

### Testing WebSocket

Using `wscat`:

```bash
npm install -g wscat

# Connect
wscat -c "ws://localhost:3000/models/ws/conversion"

# Subscribe to a job
> {"type":"subscribe","jobId":"job-123456"}

# You'll receive progress updates automatically
```

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2025-01-26T12:00:00.000Z",
  "services": {
    "forge": "connected",
    "python": "connected",
    "revitPlugin": "connected",
    "archicadPlugin": "disconnected"
  },
  "jobsActive": 2,
  "uptime": 3600
}
```

## Production

### Build

```bash
pnpm build
```

Output: `dist/` directory with compiled JavaScript.

### Run Production Build

```bash
pnpm start
```

### PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start
pm2 start dist/server.js --name ts-ifc-api-node

# Monitor
pm2 logs ts-ifc-api-node
pm2 monit

# Auto-restart on boot
pm2 startup
pm2 save
```

## Architecture

### Request Flow (Revit → IFC)

```
┌─────────┐   HTTP POST   ┌──────────┐   Forge API   ┌─────────┐
│ Frontend│──────────────>│  Node.js │──────────────>│  Forge  │
└─────────┘   multipart   │  Backend │   (cloud)     └─────────┘
                          └──────────┘
                               │
                               │ WebSocket
                               ▼
                          ┌──────────┐
                          │  Client  │ (progress updates)
                          └──────────┘
```

### Request Flow (Archicad → IFC)

```
┌─────────┐   HTTP POST   ┌──────────┐   HTTP POST   ┌────────┐
│ Frontend│──────────────>│  Node.js │──────────────>│ Python │
└─────────┘               │  Backend │               │ Bridge │
                          └──────────┘               └────────┘
                               │                          │
                               │ WebSocket                │ HTTP
                               ▼                          ▼
                          ┌──────────┐              ┌──────────┐
                          │  Client  │              │ Archicad │
                          └──────────┘              │  Plugin  │
                                                    └──────────┘
```

### Request Flow (IFC → Revit)

```
┌─────────┐   HTTP POST   ┌──────────┐   WebSocket   ┌────────┐
│ Frontend│──────────────>│  Node.js │──────────────>│ Revit  │
└─────────┘               │  Backend │               │ Plugin │
                          └──────────┘               └────────┘
                               │                          │
                               │ WebSocket                │
                               │◄─────────────────────────┘
                               ▼        (progress)
                          ┌──────────┐
                          │  Client  │
                          └──────────┘
```

## API Endpoints Reference

### POST /models/generate-ifc

Convert Revit or Archicad files to IFC.

**Request:**
```http
POST /models/generate-ifc
Content-Type: multipart/form-data

file: <.rvt or .pln file>
type: "ifc"
```

**Response:**
```json
{
  "success": true,
  "jobId": "job-1706259123456-abc123",
  "message": "Conversion job started",
  "websocketUrl": "/models/ws/conversion"
}
```

### POST /models/convert-from-ifc

Convert IFC to Revit or Archicad.

**Request:**
```http
POST /models/convert-from-ifc
Content-Type: application/json

{
  "filePath": "/path/to/file.ifc",
  "resultType": "rvt" | "pln"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job-1706259123456-xyz789",
  "message": "Conversion job started",
  "websocketUrl": "/models/ws/conversion"
}
```

### GET /models/jobs/:jobId

Get job status.

**Response:**
```json
{
  "jobId": "job-123456",
  "status": "completed",
  "progress": 100,
  "message": "Conversion completed successfully",
  "createdAt": "2025-01-26T12:00:00.000Z",
  "completedAt": "2025-01-26T12:05:00.000Z",
  "result": {
    "downloadUrl": "/jobs/job-123456/download",
    "fileName": "output.ifc",
    "fileSize": 2048000
  }
}
```

### DELETE /models/jobs/:jobId

Cancel an active job.

**Response:**
```json
{
  "success": true,
  "message": "Job cancelled successfully"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "services": {
    "forge": "connected",
    "python": "connected",
    "revitPlugin": "connected"
  }
}
```

## WebSocket Protocol

### Client → Server Messages

```typescript
type ClientMessage =
  | { type: "subscribe"; jobId: string }
  | { type: "unsubscribe"; jobId: string }
  | { type: "get_status"; jobId: string }
  | { type: "cancel_job"; jobId: string }
  | { type: "ping" }
```

### Server → Client Messages

```typescript
type ServerMessage =
  | { type: "connected"; message: string }
  | { type: "subscribed"; jobId: string }
  | { type: "progress"; jobId: string; status: string; progress: number; message: string }
  | { type: "completed"; jobId: string; result: object }
  | { type: "error"; jobId: string; error: string }
  | { type: "pong" }
```

## Services

### ForgeService

Handles Autodesk Forge/APS operations:
- `authenticate()` - Get access token
- `uploadFile()` - Upload to OSS bucket
- `convertToIfc()` - Start Model Derivative job
- `getProgress()` - Poll conversion progress
- `downloadResult()` - Download converted IFC

### PythonService

Communicates with Python bridge:
- `convertArchicadToIfc()` - Trigger Archicad conversion
- `convertIfcToArchicad()` - Trigger IFC → PLN
- `getJobStatus()` - Query Python job status
- `checkHealth()` - Verify Python service availability

### JobService

Manages conversion jobs:
- `createJob()` - Initialize new job
- `updateJob()` - Update job progress
- `getJob()` - Retrieve job status
- `cancelJob()` - Cancel active job
- `cleanupExpiredJobs()` - Remove old jobs (TTL-based)

## Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": {
    "code": "CONVERSION_FAILED",
    "message": "Failed to convert file",
    "details": "Forge API returned 400: Invalid file format"
  }
}
```

Common error codes:
- `INVALID_FILE_FORMAT` - Unsupported file extension
- `FILE_TOO_LARGE` - File exceeds 100MB limit
- `CONVERSION_FAILED` - Conversion process error
- `JOB_NOT_FOUND` - Invalid job ID
- `SERVICE_UNAVAILABLE` - External service down

## Testing

### Unit Tests

```bash
pnpm test
```

Uses Vitest for testing.

### Manual Testing

See [../../documentation/content/docs/developer-guide/backend-node.mdx](../../documentation/content/docs/developer-guide/backend-node.mdx) for detailed testing guide.

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (Windows)
taskkill /PID <PID> /F

# Kill process (Linux/Mac)
kill -9 $(lsof -ti:3000)
```

### Forge Authentication Failed

- Verify `FORGE_CLIENT_ID` and `FORGE_CLIENT_SECRET` in `.env`
- Check credentials at https://forge.autodesk.com/
- Ensure credentials have correct scopes: `data:read data:write data:create bucket:create`

### Python Service Unreachable

- Verify Python service is running: `curl http://localhost:5000/health`
- Check `PYTHON_SERVICE_HOST` and `PYTHON_SERVICE_PORT` in `.env`
- Ensure firewall allows connection

### WebSocket Connection Fails

- Check WebSocket URL: `ws://localhost:3000/models/ws/conversion`
- Verify CORS settings allow WebSocket upgrade
- Check browser console for connection errors

### Jobs Not Cleaning Up

- Verify `JOB_CLEANUP_INTERVAL_SECONDS` in `.env`
- Check logs for cleanup worker messages
- Manually trigger cleanup by restarting server

## Performance

### Optimization Tips

1. **Increase job cleanup interval** for production (e.g., 300 seconds)
2. **Use PM2 cluster mode** for multiple CPU cores
3. **Enable request caching** for Forge tokens
4. **Implement rate limiting** per client IP
5. **Add Redis** for job state persistence (future)

### Monitoring

Recommended monitoring:
- **PM2 Dashboard**: `pm2 monit`
- **Logs**: `pm2 logs ts-ifc-api-node`
- **Health Endpoint**: Automated checks every 60s

## Contributing

See [../../README.md](../../README.md) for contribution guidelines.

## License

GNU General Public License v3.0 or later.

See [../../LICENSE](../../LICENSE) for details.

## Related Documentation

- [Frontend README](../../frontend/README.md)
- [Python Backend README](../python/README.md)
- [Developer Guide](../../documentation/content/docs/developer-guide/backend-node.mdx)
- [API Reference](../../documentation/content/docs/api/endpoints.mdx)

---

**Author**: Matheus Piovezan Teixeira  
**Repository**: [github.com/Shobon03/ts-ifc-api](https://github.com/Shobon03/ts-ifc-api)
