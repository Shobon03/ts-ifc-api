# Python Backend - Archicad Integration Service

This is the Python backend service that handles Archicad integration for the ts-ifc-api project. It communicates with Archicad via the Archicad API and with the Node.js backend via WebSocket for real-time progress updates.

## Features

- Archicad .pln to IFC conversion
- WebSocket communication with Node.js backend
- Real-time conversion progress tracking
- Trigger Revit conversions via Node.js

## Prerequisites

- Python 3.9 or higher
- Archicad 28 installed and running
- Archicad API enabled (Options → Work Environment → API)
- Node.js backend running on port 3000

## Installation

1. Create a virtual environment:
```bash
python -m venv venv-python
```

2. Activate the virtual environment:
```bash
# Windows
venv-python\Scripts\activate

# Linux/macOS
source venv-python/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

5. Edit `.env` with your settings:
```env
FLASK_PORT=5000
NODE_WS_URL=ws://localhost:3000/ws/python-bridge
```

## Usage

### Start the Server

```bash
python src/server.py
```

The server will:
- Start Flask on port 5000 (default)
- Connect to Node.js WebSocket bridge
- Wait for Archicad to be available

### API Endpoints

#### Health Check
```http
GET /health
```

Returns the status of the Python server, Archicad connection, and Node.js WebSocket.

#### Convert Archicad to IFC
```http
POST /convert/archicad-to-ifc
Content-Type: multipart/form-data

file: <.pln file>
jobId: <optional job ID for tracking>
```

Converts an Archicad .pln file to IFC format. Progress updates are sent via WebSocket to the Node.js backend.

#### Trigger Revit Conversion
```http
POST /trigger-revit-conversion
Content-Type: application/json

{
  "ifcPath": "/path/to/file.ifc",
  "outputPath": "/path/to/output.rvt",
  "jobId": "optional-job-id"
}
```

Triggers an IFC to Revit conversion by sending a command to the Node.js backend, which forwards it to the Revit plugin.

#### Get Job Status
```http
GET /jobs/<job_id>/status
```

Retrieves the status of a conversion job from the Node.js backend.

## Architecture

### WebSocket Communication Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Python    │◄───WS───┤   Node.js   │◄───WS───┤   Revit     │
│   Service   │         │   Backend   │         │   Plugin    │
└─────────────┘         └─────────────┘         └─────────────┘
      │                        │
      │                        │
      ▼                        ▼
┌─────────────┐         ┌─────────────┐
│  Archicad   │         │  Frontend   │
│  API        │         │  Clients    │
└─────────────┘         └─────────────┘
```

### Message Types

#### From Python to Node.js

- `identify` - Service identification on connection
- `progress_update` - Job progress update
- `job_error` - Job error notification
- `trigger_revit_conversion` - Request Revit conversion
- `get_job_status` - Request job status
- `pong` - Heartbeat response

#### From Node.js to Python

- `connection_ack` - Connection acknowledgment
- `trigger_archicad_conversion` - Request Archicad conversion
- `ping` - Heartbeat check

## Modules

### `server.py`
Main Flask application with API endpoints.

### `websocket_client.py`
WebSocket client for communicating with Node.js backend. Handles:
- Auto-reconnection
- Message routing
- Progress updates
- Error handling

### `archicad_service.py`
Service for interacting with Archicad API. Provides:
- Connection management
- .pln to IFC conversion
- Project operations
- Progress callbacks

## Development

### Running in Development Mode

```bash
# Set debug mode in .env
FLASK_DEBUG=True

# Run server
python src/server.py
```

### Testing WebSocket Connection

You can test the WebSocket connection using a WebSocket client:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/python-bridge');

ws.onopen = () => {
  console.log('Connected to Node.js');
  ws.send(JSON.stringify({
    type: 'identify',
    service: 'test-client',
    version: '1.0.0'
  }));
};

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

## Troubleshooting

### Archicad Connection Failed

**Problem:** `Failed to connect to Archicad: Connection refused`

**Solution:**
1. Ensure Archicad is running
2. Enable API in Archicad: Options → Work Environment → API
3. Check that port 19723 is not blocked by firewall

### WebSocket Connection Failed

**Problem:** `WebSocket connection error: Connection refused`

**Solution:**
1. Ensure Node.js backend is running on port 3000
2. Check `NODE_WS_URL` in `.env` is correct
3. Verify firewall settings

### Conversion Timeout

**Problem:** Conversion takes too long and times out

**Solution:**
1. Large files may take several minutes
2. Increase timeout in Node.js service
3. Check Archicad is not showing modal dialogs

## License

GNU General Public License v3.0 or later

See [COPYING](../../COPYING) for details.

## Author

Matheus Piovezan Teixeira
- GitHub: [@Shobon03](https://github.com/Shobon03)
