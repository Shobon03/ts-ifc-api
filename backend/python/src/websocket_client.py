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

import json
import logging
import threading
import time
from typing import Callable, Dict, Optional
from websocket import WebSocketApp

logger = logging.getLogger(__name__)


class NodeJSWebSocketClient:
    """
    WebSocket client to communicate with Node.js backend.
    Handles bi-directional communication between Python service and Node.js API.
    """

    def __init__(self, url: str):
        """
        Initialize WebSocket client.

        Args:
            url: WebSocket URL of Node.js server (e.g., ws://localhost:3000/ws/python-bridge)
        """
        self.url = url
        self.ws: Optional[WebSocketApp] = None
        self.connected = False
        self.reconnect_interval = 5  # seconds
        self.message_handler: Optional[Callable[[Dict], None]] = None
        self.on_connect_handler: Optional[Callable[[], None]] = None
        self.thread: Optional[threading.Thread] = None
        self.should_reconnect = True

        logger.info(f"WebSocket client initialized for {url}")

    def connect(self):
        """
        Connect to Node.js WebSocket server with auto-reconnect.
        Runs in a separate thread to avoid blocking Flask.
        """
        if self.thread and self.thread.is_alive():
            logger.warning("WebSocket connection already active")
            return

        self.should_reconnect = True
        self.thread = threading.Thread(target=self._run_websocket, daemon=True)
        self.thread.start()
        logger.info("WebSocket connection thread started")

    def _run_websocket(self):
        """
        Internal method to run WebSocket connection with reconnection logic.
        """
        while self.should_reconnect:
            try:
                logger.info(f"Attempting to connect to {self.url}")

                self.ws = WebSocketApp(
                    self.url,
                    on_open=self._on_open,
                    on_message=self._on_message,
                    on_error=self._on_error,
                    on_close=self._on_close,
                )

                # Run forever (blocks until connection closes)
                self.ws.run_forever()

            except Exception as e:
                logger.error(f"WebSocket connection error: {e}")

            if self.should_reconnect:
                logger.info(
                    f"Reconnecting to Node.js in {self.reconnect_interval} seconds..."
                )
                time.sleep(self.reconnect_interval)

    def _on_open(self, ws):
        """
        Called when WebSocket connection is established.
        """
        self.connected = True
        logger.info("✓ Connected to Node.js WebSocket")

        # Send identification message
        self.send_message(
            {"type": "identify", "service": "python-archicad", "version": "1.0.0"}
        )

        # Call on_connect callback if set (to resend plugin statuses)
        if self.on_connect_handler:
            try:
                self.on_connect_handler()
            except Exception as e:
                logger.error(f"Error in on_connect_handler: {e}")

    def _on_message(self, ws, message):
        """
        Called when a message is received from Node.js.
        """
        try:
            data = json.loads(message)
            logger.debug(
                f"Received message from Node.js: {data.get('type', 'unknown')}"
            )

            # Call user-defined message handler
            if self.message_handler:
                self.message_handler(data)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse message from Node.js: {e}")

    def _on_error(self, ws, error):
        """
        Called when WebSocket encounters an error.
        """
        logger.error(f"WebSocket error: {error}")
        self.connected = False

    def _on_close(self, ws, close_status_code, close_msg):
        """
        Called when WebSocket connection is closed.
        """
        self.connected = False
        logger.warning(
            f"WebSocket connection closed (code: {close_status_code}, msg: {close_msg})"
        )

    def disconnect(self):
        """
        Gracefully disconnect from WebSocket server.
        """
        self.should_reconnect = False
        if self.ws:
            self.ws.close()
        self.connected = False
        logger.info("WebSocket disconnected")

    def is_connected(self) -> bool:
        """
        Check if WebSocket is currently connected.

        Returns:
            True if connected, False otherwise
        """
        return self.connected

    def send_message(self, message: Dict):
        """
        Send a JSON message to Node.js WebSocket server.

        Args:
            message: Dictionary to be sent as JSON
        """
        if not self.connected or not self.ws:
            logger.warning("Cannot send message - WebSocket not connected")
            return False

        try:
            payload = json.dumps(message)
            self.ws.send(payload)
            logger.debug(f"Sent message to Node.js: {message.get('type', 'unknown')}")
            return True
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            return False

    def send_progress(
        self,
        job_id: str,
        progress: int,
        status: str,
        message: str,
        details: Dict = None,
    ):
        """
        Send progress update for a conversion job to Node.js.

        Args:
            job_id: Unique job identifier
            progress: Progress percentage (0-100)
            status: Job status (uploading, processing, completed, error)
            message: Human-readable status message
            details: Optional additional details
        """
        payload = {
            "type": "progress_update",
            "jobId": job_id,
            "progress": max(0, min(100, progress)),
            "status": status,
            "message": message,
        }

        if details:
            payload["details"] = details

        return self.send_message(payload)

    def send_error(self, job_id: str, error_message: str):
        """
        Send error notification for a job to Node.js.

        Args:
            job_id: Unique job identifier
            error_message: Error description
        """
        return self.send_message(
            {
                "type": "job_error",
                "jobId": job_id,
                "error": error_message,
                "status": "error",
            }
        )

    def trigger_revit_conversion(
        self, job_id: str, ifc_path: str, output_path: str = None
    ) -> bool:
        """
        Request Node.js to trigger IFC→Revit conversion via Revit plugin.

        Args:
            job_id: Unique job identifier
            ifc_path: Path to IFC file
            output_path: Optional output path for .rvt file

        Returns:
            True if message sent successfully, False otherwise
        """
        return self.send_message(
            {
                "type": "trigger_revit_conversion",
                "jobId": job_id,
                "ifcPath": ifc_path,
                "outputPath": output_path,
            }
        )

    def request_job_status(self, job_id: str) -> Optional[Dict]:
        """
        Request job status from Node.js (sync operation with timeout).
        This is a simplified implementation - for production, use proper request-response pattern.

        Args:
            job_id: Unique job identifier

        Returns:
            Job status dict if available, None otherwise
        """
        # Note: This is a simplified implementation
        # In production, implement proper request-response with message IDs and callbacks
        return self.send_message({"type": "get_job_status", "jobId": job_id})

    def set_message_handler(self, handler: Callable[[Dict], None]):
        """
        Set callback function to handle incoming messages from Node.js.

        Args:
            handler: Function that takes a dict (parsed JSON message)
        """
        self.message_handler = handler
        logger.info("Message handler set")

    def set_on_connect_handler(self, handler: Callable[[], None]):
        """
        Set callback function to be called when connection to Node.js is established.
        Useful for resending plugin statuses after reconnection.

        Args:
            handler: Function to call when connected (no arguments)
        """
        self.on_connect_handler = handler
        logger.info("On-connect handler set")
