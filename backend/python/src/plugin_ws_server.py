"""
Copyright (C) 2025 Matheus Piovezan Teixeira

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, Optional

import websockets
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK
from websockets.server import WebSocketServerProtocol

from websocket_client import NodeJSWebSocketClient

logger = logging.getLogger(__name__)


class PluginType(str, Enum):
    """Supported desktop plugins that speak with the Python bridge."""

    ARCHICAD = "archicad"
    REVIT = "revit"


@dataclass
class PluginConnection:
    """Data container describing an active plugin WebSocket connection."""

    plugin_type: PluginType
    websocket: WebSocketServerProtocol
    version: Optional[str] = None
    last_heartbeat: float = field(default_factory=lambda: time.time())


class PluginWebSocketServer:
    """Hosts local WebSocket endpoints for desktop plugins.

    The server runs in its own asyncio event loop (on a background thread) so it
    can coexist with the synchronous Flask application. Incoming plugin
    messages are normalised and forwarded to Node.js through the
    `NodeJSWebSocketClient` so that the API keeps full control over job state.
    """

    def __init__(
        self,
        host: str,
        port: int,
        node_ws_client: NodeJSWebSocketClient,
        job_event_handler: Optional[Callable[[PluginType, Dict[str, Any]], None]] = None,
    ) -> None:
        self._host = host
        self._port = port
        self._node_ws = node_ws_client
        self._job_event_handler = job_event_handler
        self._connections: Dict[PluginType, PluginConnection] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._server: Optional[websockets.server.Serve] = None
        self._thread: Optional[threading.Thread] = None

    # ---------------------------------------------------------------------
    # Lifecycle management
    # ---------------------------------------------------------------------
    def start(self) -> None:
        """Spawn the server loop on a daemon thread."""

        if self._thread and self._thread.is_alive():
            logger.warning("Plugin WebSocket server already running")
            return

        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info(
            "Plugin WebSocket server thread initialised (listening on %s:%s)",
            self._host,
            self._port,
        )

    def _run_loop(self) -> None:
        """Initialise the asyncio event loop used by the WebSocket server."""

        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        async def start_server() -> None:
            logger.info(
                "Starting plugin WebSocket server on ws://%s:%s", self._host, self._port
            )
            self._server = await websockets.serve(
                self._handle_connection,
                self._host,
                self._port,
            )
            await asyncio.Future()  # Run forever

        try:
            self._loop.run_until_complete(start_server())
        except Exception as exc:  # pragma: no cover - fatal error logging
            logger.exception("Plugin WebSocket server failed: %s", exc)
        finally:
            if self._loop and not self._loop.is_closed():
                self._loop.close()

    def stop(self) -> None:
        """Gracefully stop the WebSocket server."""

        if not self._loop:
            return

        async def shutdown() -> None:
            if self._server:
                self._server.close()
                await self._server.wait_closed()
            # Close outstanding plugin connections
            await asyncio.gather(
                *[
                    conn.websocket.close()
                    for conn in list(self._connections.values())
                ],
                return_exceptions=True,
            )

        asyncio.run_coroutine_threadsafe(shutdown(), self._loop)
        logger.info("Plugin WebSocket server shutdown initiated")

    # ---------------------------------------------------------------------
    # WebSocket handlers
    # ---------------------------------------------------------------------
    async def _handle_connection(
        self,
        websocket: WebSocketServerProtocol,
        path: str,
    ) -> None:
        plugin_type = self._resolve_plugin_type(path)
        if not plugin_type:
            await websocket.close(code=4000, reason="Unsupported plugin")
            logger.warning("Rejected plugin connection on unknown path: %s", path)
            return

        connection = PluginConnection(plugin_type=plugin_type, websocket=websocket)
        self._connections[plugin_type] = connection
        logger.info("%s plugin connected", plugin_type.value.capitalize())
        self._emit_job_event(
            plugin_type,
            {
                "event": "plugin_connected",
                "plugin": plugin_type.value,
            },
        )

        await self._send_json(
            websocket,
            {
                "type": "connection_ack",
                "plugin": plugin_type.value,
                "message": "Connected to Python bridge",
            },
        )

        try:
            async for raw in websocket:
                await self._handle_plugin_message(connection, raw)
        except (ConnectionClosedOK, ConnectionClosedError):
            logger.info("%s plugin disconnected", plugin_type.value.capitalize())
            self._emit_job_event(
                plugin_type,
                {
                    "event": "plugin_disconnected",
                    "plugin": plugin_type.value,
                },
            )
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.exception(
                "Error while handling %s plugin socket: %s",
                plugin_type.value,
                exc,
            )
        finally:
            self._connections.pop(plugin_type, None)

    async def _handle_plugin_message(
        self,
        connection: PluginConnection,
        raw_message: str,
    ) -> None:
        try:
            message = json.loads(raw_message)
        except json.JSONDecodeError:
            logger.error("Received invalid JSON from %s plugin", connection.plugin_type)
            return

        message_type = message.get("type") or message.get("command")
        job_id = message.get("jobId")
        connection.last_heartbeat = time.time()

        logger.debug(
            "Plugin %s -> Python: %s",
            connection.plugin_type.value,
            message_type,
        )

        if message_type in {"status", "plugin_status"}:
            connection.version = message.get("version")
            self._node_ws.send_message(
                {
                    "type": "plugin_status",
                    "plugin": connection.plugin_type.value,
                    "status": message.get("status", "unknown"),
                    "message": message.get("message"),
                    "version": connection.version,
                }
            )
            self._emit_job_event(
                connection.plugin_type,
                {
                    "event": "plugin_status",
                    "status": message.get("status"),
                    "message": message.get("message"),
                    "version": connection.version,
                },
            )
            return

        if not job_id:
            logger.warning(
                "Ignoring %s message without jobId from %s plugin",
                message_type,
                connection.plugin_type.value,
            )
            return

        if message_type in {"conversion_started", "start_ack"}:
            self._node_ws.send_progress(
                job_id,
                0,
                "processing",
                message.get("message", "Plugin started conversion"),
                details={"plugin": connection.plugin_type.value},
            )
            self._emit_job_event(
                connection.plugin_type,
                {
                    "event": "conversion_started",
                    "jobId": job_id,
                    "message": message.get("message"),
                },
            )
            return

        if message_type in {"progress", "conversion_progress"}:
            progress = int(message.get("progress", 0))
            status = self._map_status(message.get("status"))
            self._node_ws.send_progress(
                job_id,
                progress,
                status,
                message.get("message", f"{connection.plugin_type.value} progress"),
                details={
                    "plugin": connection.plugin_type.value,
                    "pluginJobId": job_id,
                },
            )
            self._emit_job_event(
                connection.plugin_type,
                {
                    "event": "conversion_progress",
                    "jobId": job_id,
                    "status": status,
                    "progress": progress,
                    "message": message.get("message"),
                },
            )
            return

        if message_type in {"conversion_completed", "completed", "success"}:
            result_payload = message.get("result") or {}
            download_url = result_payload.get("downloadUrl") or f"/jobs/{job_id}/download"
            self._node_ws.send_progress(
                job_id,
                100,
                "completed",
                message.get("message", "Conversion finished"),
                details={
                    "plugin": connection.plugin_type.value,
                    "pluginJobId": job_id,
                    "result": {
                        **result_payload,
                        "downloadUrl": download_url,
                    },
                },
            )
            self._node_ws.send_message(
                {
                    "type": "plugin_conversion_completed",
                    "plugin": connection.plugin_type.value,
                    "jobId": job_id,
                    "result": {
                        **result_payload,
                        "downloadUrl": download_url,
                    },
                }
            )
            self._emit_job_event(
                connection.plugin_type,
                {
                    "event": "conversion_completed",
                    "jobId": job_id,
                    "result": {
                        **result_payload,
                        "downloadUrl": download_url,
                    },
                    "message": message.get("message"),
                },
            )
            return

        if message_type in {"conversion_failed", "error"}:
            error_text = message.get("error") or message.get("message") or "Conversion failed"
            self._node_ws.send_error(job_id, error_text)
            self._node_ws.send_message(
                {
                    "type": "plugin_conversion_failed",
                    "plugin": connection.plugin_type.value,
                    "jobId": job_id,
                    "error": error_text,
                }
            )
            self._emit_job_event(
                connection.plugin_type,
                {
                    "event": "conversion_failed",
                    "jobId": job_id,
                    "error": error_text,
                },
            )
            return

        if message_type in {"conversion_cancelled", "cancelled"}:
            self._node_ws.send_progress(
                job_id,
                0,
                "cancelled",
                message.get("message", "Conversion cancelled"),
                details={"plugin": connection.plugin_type.value},
            )
            self._emit_job_event(
                connection.plugin_type,
                {
                    "event": "conversion_cancelled",
                    "jobId": job_id,
                    "message": message.get("message"),
                },
            )
            return

        logger.warning(
            "Unhandled message '%s' from %s plugin",
            message_type,
            connection.plugin_type.value,
        )

    # ------------------------------------------------------------------
    # Command helpers used by the Flask app / Node -> plugin bridge
    # ------------------------------------------------------------------
    def start_archicad_conversion(
        self,
        job_id: str,
        pln_path: str,
        output_path: Optional[str] = None,
    ) -> bool:
        payload: Dict[str, Any] = {
            "action": "start_conversion",
            "job_id": job_id,
            "file_path": pln_path,
            "command": "start_conversion",
            "jobId": job_id,
            "plnPath": pln_path,
        }
        if output_path:
            payload["output_path"] = output_path
            payload["outputPath"] = output_path
        return self._send_command(PluginType.ARCHICAD, payload)

    def start_revit_conversion(
        self,
        job_id: str,
        ifc_path: str,
        output_path: Optional[str] = None,
    ) -> bool:
        payload: Dict[str, Any] = {
            "action": "start_conversion",
            "job_id": job_id,
            "file_path": ifc_path,
            "command": "start_conversion",
            "jobId": job_id,
            "ifcPath": ifc_path,
        }
        if output_path:
            payload["output_path"] = output_path
            payload["outputPath"] = output_path
        return self._send_command(PluginType.REVIT, payload)

    def cancel_job(self, plugin: PluginType, job_id: str) -> bool:
        return self._send_command(plugin, {"command": "cancel_job", "jobId": job_id})

    def request_status(self, plugin: PluginType, job_id: str = "status-check") -> bool:
        return self._send_command(plugin, {"command": "get_status", "jobId": job_id})

    def is_plugin_connected(self, plugin: PluginType) -> bool:
        return plugin in self._connections

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _send_command(self, plugin: PluginType, payload: Dict[str, Any]) -> bool:
        connection = self._connections.get(plugin)
        if not connection:
            logger.warning("No active %s plugin connection", plugin.value)
            return False

        if not self._loop:
            logger.error("Plugin WebSocket server loop is not running")
            return False

        async def _send() -> None:
            await self._send_json(connection.websocket, payload)

        future = asyncio.run_coroutine_threadsafe(_send(), self._loop)
        try:
            future.result(timeout=5)
            logger.info(
                "Command sent to %s plugin: %s",
                plugin.value,
                payload.get("command") or payload.get("action"),
            )
            return True
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.error("Failed to send command to %s plugin: %s", plugin.value, exc)
            return False

    async def _send_json(
        self,
        websocket: WebSocketServerProtocol,
        payload: Dict[str, Any],
    ) -> None:
        await websocket.send(json.dumps(payload))

    def _resolve_plugin_type(self, path: str) -> Optional[PluginType]:
        normalised = (path or "").strip("/ ").lower()
        if normalised in {"archicad", "archicad-plugin"}:
            return PluginType.ARCHICAD
        if normalised in {"revit", "revit-plugin"}:
            return PluginType.REVIT
        return None

    def _map_status(self, plugin_status: Optional[str]) -> str:
        if not plugin_status:
            return "processing"
        status = plugin_status.lower()
        status_map = {
            "queued": "queued",
            "uploading": "uploading",
            "processing": "processing",
            "downloading": "downloading",
            "completed": "completed",
            "success": "completed",
            "error": "error",
            "failed": "error",
            "cancelled": "cancelled",
        }
        return status_map.get(status, "processing")

    def _emit_job_event(self, plugin: PluginType, payload: Dict[str, Any]) -> None:
        if not self._job_event_handler:
            return
        try:
            self._job_event_handler(plugin, payload)
        except Exception as exc:  # pragma: no cover - defensive log
            logger.exception("Job event handler raised an error: %s", exc)


__all__ = ["PluginWebSocketServer", "PluginType"]
