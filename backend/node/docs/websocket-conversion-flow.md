# Archicad Conversion Flow (Node ↔ Python ↔ Plugin)

This guide explains the end-to-end process for submitting a `.pln` file to the Node backend, tracking progress over WebSocket, and downloading the converted IFC artifact produced by the Windows Archicad plugin.

## Prerequisites

- Node backend running locally (`npm run dev`) or deployed.
- Python bridge running (`python src/server.py`) with `PLUGIN_WS_PORT` reachable from the plugin.
- Archicad plugin running on the Windows machine and connected to the Python bridge.
- Environment variables in Node configured so that `PYTHON_SERVICE_HOST` (and optional `PYTHON_SERVICE_PORT`) resolve to the Python bridge from the Node server.
- Networking allows Node ⇄ Python (HTTP) and Python ⇄ plugin (WebSocket) communication.

## 1. Upload the source file

Send a multipart POST to `POST /models/generate-ifc` containing the `.pln` file.

```bash
curl -X POST "http://localhost:3001/models/generate-ifc" \
  -F "file=@example.pln" \
  -F "type=ifc"
```

**Response (HTTP 200)**

```json
{
  "jobId": "job-1760576188342-fkwqq9ywii",
  "message": "Conversion job started",
  "websocketUrl": "/models/ws/conversion"
}
```

The response indicates that the file was uploaded to the Python bridge and the Archicad plugin was asked to start the conversion. All further progress is delivered by WebSocket events.

## 2. Connect to the WebSocket feed

The Node backend exposes a WebSocket at `/models/ws/conversion`. You can either pass the `jobId` as a query string or send a `subscribe` message after connecting.

```bash
wscat -c "ws://localhost:3001/models/ws/conversion?jobId=job-1760576188342-fkwqq9ywii"
```

Upon connection, the server emits a `connected` message and, if the `jobId` was present in the URL, an `auto-subscribed` message. If you did **not** pass the job ID in the URL, send a subscription payload:

```json
{"type":"subscribe","jobId":"job-1760576188342-fkwqq9ywii"}
```

Successful subscription yields:

```json
{
  "type": "subscribed",
  "jobId": "job-1760576188342-fkwqq9ywii",
  "message": "Successfully subscribed to job updates"
}
```

## 3. Monitor progress events

Every status update from the Python bridge or Archicad plugin is re-broadcast as a `progress` message. The payload follows the `ConversionProgress` interface:

```json
{
  "type": "progress",
  "jobId": "job-1760576188342-fkwqq9ywii",
  "status": "processing",
  "progress": 40,
  "message": "File sent to Archicad bridge, awaiting plugin confirmation",
  "details": {
    "plugin": "archicad",
    "pythonJobId": "archicad-123456",
    "downloadUrl": "/jobs/job-1760576188342-fkwqq9ywii/download"
  }
}
```

Important `status` values:

- `queued` – job registered, waiting to be dispatched
- `uploading` – file being delivered to the Python bridge
- `processing` – Python or plugin currently converting
- `downloading` – preparing final artifact (if reported)
- `completed` – artifact available for download
- `error` / `cancelled` – terminal failure or cancellation

Final completion message typically includes `details.result.downloadUrl`, `details.result.fileName`, and `details.result.fileSize` populated by the Python server.

## 4. Download the converted IFC

When you receive a `status` of `completed`, issue a GET against the Python bridge to fetch the artifact. The default endpoint is:

```bash
curl -L -o output.ifc "http://<python-host>:<python-port>/jobs/job-1760576188342-fkwqq9ywii/download"
```

You can confirm metadata beforehand:

```bash
curl "http://<python-host>:<python-port>/jobs/job-1760576188342-fkwqq9ywii"
```

This returns the job record (including `downloadUrl`, `outputSize`, timestamps, and plugin messages).

## 5. Troubleshooting

- **Stuck after upload**: ensure the Archicad plugin is running and connected to the Python bridge (`/health` shows `pluginWebSockets.archicad: connected`).
- **WebSocket shows only `queued`**: confirm that `PYTHON_SERVICE_HOST` in Node resolves to the Python machine’s IP; the Node backend must reach `http://<python-host>:<port>`.
- **Download fails (404/410)**: job may have expired or plugin did not produce output. Check `/jobs/<jobId>` for `status` and `error` fields.
- **Multiple clients**: you can subscribe multiple sockets to the same `jobId`; each receives identical `progress` messages.

Following these steps ensures a complete round trip: upload, monitor in real time, and retrieve the plugin-generated IFC file.
