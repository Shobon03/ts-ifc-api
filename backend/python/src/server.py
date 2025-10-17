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

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
import json
import os
import logging
import tempfile
import shutil
import threading
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

# Import custom modules
from websocket_client import NodeJSWebSocketClient
from plugin_ws_server import PluginType, PluginWebSocketServer

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Resolve directory structure
_job_storage_override = os.getenv('JOB_STORAGE_ROOT')
if _job_storage_override:
    JOB_STORAGE_ROOT = Path(_job_storage_override)
else:
    JOB_STORAGE_ROOT = Path(tempfile.gettempdir()) / 'ts_ifc_jobs'
JOB_STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

JOB_TTL_MINUTES = int(os.getenv('JOB_TTL_MINUTES', '180'))
JOB_POLL_INTERVAL_SECONDS = int(os.getenv('JOB_CLEANUP_INTERVAL_SECONDS', '60'))

# Directories for uploads and artifacts per job
INPUT_DIRNAME = 'input'
OUTPUT_DIRNAME = 'output'
METADATA_FILENAME = 'job.json'

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=os.getenv('CORS_ORIGINS', '*').split(','))

# Initialize services
ws_client = NodeJSWebSocketClient(
    url=os.getenv('NODE_WS_URL', 'ws://localhost:3000/ws/python-bridge')
)

# Synchronisation primitives
_jobs_lock = threading.Lock()
_cleanup_stop_event = threading.Event()
_cleanup_thread: Optional[threading.Thread] = None
_background_lock = threading.Lock()
_background_started = False


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _job_directory(job_id: str) -> Path:
    return JOB_STORAGE_ROOT / job_id


def _job_meta_path(job_id: str) -> Path:
    return _job_directory(job_id) / METADATA_FILENAME


def _input_path(job_id: str, filename: str) -> Path:
    directory = _job_directory(job_id) / INPUT_DIRNAME
    directory.mkdir(parents=True, exist_ok=True)
    return directory / filename


def _output_path(job_id: str, filename: str) -> Path:
    directory = _job_directory(job_id) / OUTPUT_DIRNAME
    directory.mkdir(parents=True, exist_ok=True)
    return directory / filename


def _safe_getsize(path: str) -> Optional[int]:
    try:
        return os.path.getsize(path)
    except OSError:
        return None


def _persist_job(job_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    with _jobs_lock:
        meta_path = _job_meta_path(job_id)
        meta_path.parent.mkdir(parents=True, exist_ok=True)

        existing: Dict[str, Any] = {}
        if meta_path.exists():
            try:
                existing = json.loads(meta_path.read_text())
            except json.JSONDecodeError:
                logger.warning("Corrupted metadata for job %s; recreating", job_id)

        now_iso = _utc_now().isoformat()
        created_at = existing.get('createdAt', now_iso)
        updates_copy = dict(updates)
        override_expiry = updates_copy.pop('expiresAt', None)

        expires_at = override_expiry or existing.get('expiresAt')
        if not expires_at:
            expiry_dt = _utc_now() + timedelta(minutes=JOB_TTL_MINUTES)
            expires_at = expiry_dt.isoformat()

        if 'progress' in updates_copy:
            try:
                updates_copy['progress'] = int(updates_copy['progress'])
            except (TypeError, ValueError):
                updates_copy.pop('progress', None)

        record = {
            **existing,
            **updates_copy,
            'jobId': job_id,
            'createdAt': created_at,
            'updatedAt': now_iso,
            'expiresAt': expires_at,
        }

        meta_path.write_text(json.dumps(record, indent=2))
        return record


def _load_job(job_id: str) -> Optional[Dict[str, Any]]:
    meta_path = _job_meta_path(job_id)
    if not meta_path.exists():
        return None
    try:
        return json.loads(meta_path.read_text())
    except json.JSONDecodeError:
        logger.error("Failed to decode metadata for job %s", job_id)
        return None


def _delete_job(job_id: str) -> None:
    job_dir = _job_directory(job_id)
    if not job_dir.exists():
        return
    logger.info("Removing job artifacts for %s", job_id)
    shutil.rmtree(job_dir, ignore_errors=True)


def _is_job_expired(job: Dict[str, Any]) -> bool:
    expires_at = job.get('expiresAt')
    if not expires_at:
        return False
    try:
        expiry = datetime.fromisoformat(expires_at)
    except ValueError:
        return False
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    return _utc_now() > expiry


def _cleanup_worker() -> None:
    logger.info("Job cleanup worker started (interval=%ss, ttl=%s minutes)",
                JOB_POLL_INTERVAL_SECONDS, JOB_TTL_MINUTES)
    while not _cleanup_stop_event.wait(timeout=JOB_POLL_INTERVAL_SECONDS):
        try:
            for meta_file in JOB_STORAGE_ROOT.glob(f"*/{METADATA_FILENAME}"):
                job_id = meta_file.parent.name
                job = _load_job(job_id)
                if not job:
                    continue
                if _is_job_expired(job):
                    _delete_job(job_id)
        except Exception as exc:  # pragma: no cover - defensive log
            logger.exception("Job cleanup worker error: %s", exc)


def _start_cleanup_thread() -> None:
    global _cleanup_thread
    if _cleanup_thread and _cleanup_thread.is_alive():
        return
    _cleanup_thread = threading.Thread(target=_cleanup_worker, daemon=True)
    _cleanup_thread.start()


def _generate_job_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _ensure_background_services() -> None:
    global _background_started
    with _background_lock:
        if _background_started:
            return
        ws_client.connect()
        plugin_ws_server.start()
        _start_cleanup_thread()
        _background_started = True


def _handle_plugin_job_event(plugin: PluginType, payload: Dict[str, Any]) -> None:
    job_id = payload.get('jobId')
    event = payload.get('event')
    if not job_id:
        # Status updates without job context are informational only
        return

    updates: Dict[str, Any] = {
        'plugin': plugin.value,
        'lastPluginEvent': event,
        'lastPluginMessage': payload.get('message'),
        'lastPluginEventAt': _utc_now().isoformat(),
    }

    # Extend TTL on each plugin heartbeat/progress
    updates['expiresAt'] = (_utc_now() + timedelta(minutes=JOB_TTL_MINUTES)).isoformat()

    if event == 'conversion_started':
        updates.update({
            'status': 'processing',
            'progress': 0,
            'message': payload.get('message', 'Plugin started conversion'),
        })
    elif event == 'conversion_progress':
        updates.update({
            'status': payload.get('status', 'processing'),
            'progress': int(payload.get('progress', 0)),
            'message': payload.get('message', 'Plugin reported progress'),
        })
    elif event == 'conversion_completed':
        updates.update({
            'status': 'completed',
            'progress': 100,
            'message': payload.get('message', 'Conversion completed via plugin'),
            'completedAt': _utc_now().isoformat(),
        })
        result_info = payload.get('result') or {}
        output_path = result_info.get('outputPath') or updates.get('outputPath')
        if output_path:
            updates['outputPath'] = output_path
            updates.setdefault('downloadPath', output_path)
            try:
                updates['outputSize'] = os.path.getsize(output_path)
            except OSError:
                logger.warning("Could not determine size for %s", output_path)
        download_url = result_info.get('downloadUrl')
        if download_url:
            updates['downloadUrl'] = download_url
        else:
            updates.setdefault('downloadUrl', f"/jobs/{job_id}/download")
        if 'fileSize' in result_info and isinstance(result_info['fileSize'], (int, float)):
            updates['outputSize'] = int(result_info['fileSize'])
        if result_info.get('fileName'):
            updates['downloadName'] = result_info['fileName']
    elif event == 'conversion_failed':
        error_text = payload.get('error', 'Plugin conversion failed')
        updates.update({
            'status': 'error',
            'progress': 0,
            'message': error_text,
            'error': error_text,
        })
    elif event == 'conversion_cancelled':
        updates.update({
            'status': 'cancelled',
            'progress': 0,
            'message': payload.get('message', 'Plugin cancelled conversion'),
        })

    _persist_job(job_id, updates)


plugin_ws_server = PluginWebSocketServer(
    host=os.getenv('PLUGIN_WS_HOST', '127.0.0.1'),
    port=int(os.getenv('PLUGIN_WS_PORT', '8766')),
    node_ws_client=ws_client,
    job_event_handler=_handle_plugin_job_event,
)
if hasattr(app, "before_serving"):

    @app.before_serving
    def _bootstrap_background_services() -> None:
        _ensure_background_services()

else:

    @app.before_request
    def _bootstrap_background_services() -> None:  # pragma: no cover - legacy hook
        _ensure_background_services()


@app.route('/health', methods=['GET'])
def health():
    """
    Health check endpoint
    Returns the status of Python server, Node bridge and plugin sockets
    """
    node_ws_status = ws_client.is_connected()
    plugin_states = {
        plugin.value: 'connected' if plugin_ws_server.is_plugin_connected(plugin) else 'disconnected'
        for plugin in PluginType
    }
    cleanup_active = _cleanup_thread.is_alive() if _cleanup_thread else False

    return jsonify({
        'status': 'ok',
        'nodeWebSocket': 'connected' if node_ws_status else 'disconnected',
        'pluginWebSockets': plugin_states,
        'cleanupWorker': 'alive' if cleanup_active else 'stopped',
        'jobStorageRoot': str(JOB_STORAGE_ROOT),
        'version': '1.1.0'
    }), 200

@app.route('/convert/archicad-to-ifc', methods=['POST'])
def convert_archicad_to_ifc():
    """
    Dispatch Archicad .pln conversion to the desktop plugin via WebSocket.

    Accepts multipart/form-data with:
    - file: .pln file (required)
    - jobId (optional): Job ID for progress tracking
    - filePath (optional): Path to a staged .pln file accessible to the plugin

    Returns a JSON payload containing job metadata.
    """
    try:
        _ensure_background_services()

        incoming_file = request.files.get('file')
        if incoming_file and incoming_file.filename == '':
            incoming_file = None

        raw_file_path = request.form.get('filePath') or request.form.get('plnPath') or ''
        file_path_field = raw_file_path.strip() or None

        if not incoming_file and not file_path_field:
            return jsonify({'error': 'No file payload provided. Supply a file or filePath.'}), 400

        job_id = request.form.get('jobId') or _generate_job_id('archicad')

        staged_bytes_raw = request.form.get('stagedBytes')
        staged_bytes: Optional[int] = None
        if staged_bytes_raw:
            try:
                staged_bytes = int(staged_bytes_raw)
            except (TypeError, ValueError):
                staged_bytes = None

        staging_hint = (request.form.get('stagingStrategy') or '').strip() or None

        input_path: Optional[str] = None
        original_filename: str
        staging_strategy: str

        if file_path_field:
            # Handle both Windows and Unix paths
            expanded = os.path.expandvars(file_path_field)
            candidate = Path(expanded).expanduser()

            try:
                resolved_candidate = candidate.resolve(strict=False)
            except (OSError, RuntimeError) as e:
                logger.warning(f"Failed to resolve path {candidate}: {e}")
                resolved_candidate = candidate.absolute()

            logger.info(f"Checking file path: {resolved_candidate}")

            if not resolved_candidate.exists():
                return jsonify({'error': f"Provided filePath does not exist: {resolved_candidate}"}), 400

            if not resolved_candidate.is_file():
                return jsonify({'error': f"Provided filePath is not a file: {resolved_candidate}"}), 400

            if resolved_candidate.suffix.lower() != '.pln':
                return jsonify({'error': 'Invalid file format. Only .pln files are accepted'}), 400

            input_path = str(resolved_candidate)
            original_filename = request.form.get('originalFilename') or resolved_candidate.name or f"{job_id}.pln"
            staging_strategy = staging_hint or 'node-staging'
        else:
            if not incoming_file or not incoming_file.filename:
                return jsonify({'error': 'No file provided'}), 400
            original_filename = incoming_file.filename
            if not original_filename.lower().endswith('.pln'):
                return jsonify({'error': 'Invalid file format. Only .pln files are accepted'}), 400
            safe_filename = secure_filename(original_filename) or f"{job_id}.pln"
            input_path = str(_input_path(job_id, safe_filename))
            staging_strategy = staging_hint or 'direct-upload'

        download_name = secure_filename(f"{Path(original_filename).stem or job_id}.ifc")

        # Check if Node.js provided an outputPath
        requested_output_path = request.form.get('outputPath')
        if requested_output_path:
            output_path = str(Path(requested_output_path).resolve(strict=False))
            # Ensure the output directory exists
            try:
                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            except Exception as exc:
                logger.warning(f"Could not ensure output directory for job {job_id}: {exc}")
        else:
            output_path = str(_output_path(job_id, download_name))

        storage_root = str(_job_directory(job_id))

        if not plugin_ws_server.is_plugin_connected(PluginType.ARCHICAD):
            error_msg = 'Archicad plugin is not connected to Python bridge'
            logger.error(error_msg)
            _persist_job(job_id, {
                'plugin': PluginType.ARCHICAD.value,
                'status': 'error',
                'progress': 0,
                'message': error_msg,
                'originalFilename': original_filename,
                'inputPath': input_path,
                'stagingStrategy': staging_strategy,
            })
            ws_client.send_error(job_id, error_msg)
            return jsonify({'error': error_msg, 'jobId': job_id}), 503

        logger.info(f"Dispatching Archicad→IFC conversion for job {job_id}")

        initial_message = 'Awaiting upload' if staging_strategy == 'direct-upload' else 'Using staged PLN path from Node backend'

        _persist_job(job_id, {
            'plugin': PluginType.ARCHICAD.value,
            'status': 'queued',
            'progress': 0,
            'message': initial_message,
            'originalFilename': original_filename,
            'downloadName': download_name,
            'storagePath': storage_root,
            'inputPath': input_path,
            'stagingStrategy': staging_strategy,
            'stagedBytes': staged_bytes,
        })

        observed_size: Optional[int] = staged_bytes

        if staging_strategy == 'direct-upload' and incoming_file:
            incoming_file.save(input_path)
            observed_size = _safe_getsize(input_path)
            ws_client.send_progress(
                job_id,
                10,
                'uploading',
                'File uploaded to Python server',
                details={
                    'inputPath': input_path,
                    'stagingStrategy': staging_strategy,
                    'stagedBytes': observed_size,
                },
            )
            upload_message = 'File uploaded to Python server'
        else:
            if observed_size is None:
                observed_size = _safe_getsize(input_path)
            ws_client.send_progress(
                job_id,
                10,
                'uploading',
                'File path registered on Python bridge',
                details={
                    'inputPath': input_path,
                    'stagingStrategy': staging_strategy,
                    'stagedBytes': observed_size,
                },
            )
            upload_message = 'File path registered on Python bridge'

        _persist_job(job_id, {
            'status': 'uploading',
            'progress': 10,
            'message': upload_message,
            'inputPath': input_path,
            'stagingStrategy': staging_strategy,
            'stagedBytes': observed_size,
        })

        dispatched = plugin_ws_server.start_archicad_conversion(
            job_id=job_id,
            pln_path=input_path,
            output_path=output_path,
        )

        if not dispatched:
            error_msg = 'Failed to dispatch conversion command to Archicad plugin'
            logger.error(error_msg)
            _persist_job(job_id, {
                'status': 'error',
                'progress': 0,
                'message': error_msg,
            })
            ws_client.send_error(job_id, error_msg)
            return jsonify({'error': error_msg, 'jobId': job_id}), 500

        ws_client.send_progress(
            job_id,
            20,
            'queued',
            'Conversion request accepted by Python bridge',
            details={
                'inputPath': input_path,
                'outputPath': output_path,
                'stagingStrategy': staging_strategy,
                'stagedBytes': observed_size,
            },
        )

        _persist_job(job_id, {
            'status': 'processing',
            'progress': 20,
            'message': 'Awaiting conversion on Archicad plugin',
            'inputPath': input_path,
            'outputPath': output_path,
            'downloadPath': output_path,
            'downloadName': download_name,
            'storagePath': storage_root,
            'stagingStrategy': staging_strategy,
            'stagedBytes': observed_size,
        })

        return jsonify({
            'success': True,
            'jobId': job_id,
            'downloadUrl': f"/jobs/{job_id}/download",
            'message': 'Archicad conversion dispatched to plugin'
        }), 202

    except Exception as e:
        error_msg = f"Server error: {str(e)}"
        logger.error(error_msg)
        return jsonify({'error': error_msg}), 500

@app.route('/trigger-revit-conversion', methods=['POST'])
def trigger_revit_conversion():
    """
    Trigger IFC→Revit conversion through the local Python↔plugin WebSocket bridge.

    Accepts JSON with:
    - ifcPath: Path to the IFC file that should be converted by the plugin
    - outputPath (optional): Desired output path for the resulting .rvt
    - jobId (optional): Job identifier to reuse an existing job record
    - downloadName (optional): Custom filename to expose when downloading

    Returns job ID and status
    """
    try:
        _ensure_background_services()
        data = request.get_json(silent=True) or {}

        if 'ifcPath' not in data:
            return jsonify({'error': 'Missing ifcPath in request body'}), 400

        ifc_path = data['ifcPath']
        job_id = data.get('jobId') or _generate_job_id('revit')
        download_name = data.get('downloadName') or f"{Path(ifc_path).stem or job_id}.rvt"
        download_name = secure_filename(download_name) or f"{job_id}.rvt"
        requested_output_path = data.get('outputPath')
        if requested_output_path:
            output_path = requested_output_path
            try:
                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            except Exception as exc:
                logger.warning("Could not ensure output directory for job %s: %s", job_id, exc)
        else:
            output_path = str(_output_path(job_id, download_name))

        if not plugin_ws_server.is_plugin_connected(PluginType.REVIT):
            error_msg = 'Revit plugin is not connected to Python bridge'
            logger.error(error_msg)
            _persist_job(job_id, {
                'plugin': PluginType.REVIT.value,
                'status': 'error',
                'message': error_msg,
                'progress': 0,
                'ifcPath': ifc_path,
            })
            ws_client.send_error(job_id, error_msg)
            return jsonify({'error': error_msg, 'jobId': job_id}), 503

        logger.info(f"Triggering Revit conversion for job {job_id}")

        _persist_job(job_id, {
            'plugin': PluginType.REVIT.value,
            'status': 'queued',
            'progress': 0,
            'message': 'Dispatching conversion request to Revit plugin',
            'ifcPath': ifc_path,
            'outputPath': output_path,
            'downloadPath': output_path,
            'downloadName': download_name,
            'storagePath': str(_job_directory(job_id)),
        })

        dispatched = plugin_ws_server.start_revit_conversion(
            job_id=job_id,
            ifc_path=ifc_path,
            output_path=output_path,
        )

        if not dispatched:
            error_msg = 'Failed to dispatch conversion command to Revit plugin'
            _persist_job(job_id, {
                'status': 'error',
                'message': error_msg,
            })
            ws_client.send_error(job_id, error_msg)
            return jsonify({'error': error_msg, 'jobId': job_id}), 500

        ws_client.send_progress(job_id, 0, 'queued', 'Conversion request accepted by Python bridge')
        _persist_job(job_id, {
            'status': 'processing',
            'message': 'Conversion in progress on Revit plugin',
        })

        return jsonify({
            'success': True,
            'jobId': job_id,
            'downloadUrl': f"/jobs/{job_id}/download",
            'message': 'Revit conversion triggered successfully'
        }), 202

    except Exception as e:
        error_msg = f"Error triggering Revit conversion: {str(e)}"
        logger.error(error_msg)
        return jsonify({'error': error_msg}), 500

@app.route('/convert/ifc-to-archicad', methods=['POST'])
def convert_ifc_to_archicad():
    """
    Dispatch IFC→PLN conversion to the Archicad desktop plugin via WebSocket.

    Accepts multipart/form-data with:
    - filePath: Path to the IFC file accessible to the plugin (required)
    - outputPath (optional): Desired output path for the resulting .pln
    - jobId (optional): Job ID for progress tracking
    - originalFilename (optional): Original filename for metadata

    Returns a JSON payload containing job metadata.
    """
    try:
        _ensure_background_services()

        raw_file_path = request.form.get('filePath') or ''
        file_path_field = raw_file_path.strip() or None

        if not file_path_field:
            return jsonify({'error': 'filePath is required'}), 400

        job_id = request.form.get('jobId') or _generate_job_id('archicad-ifc')

        # Handle both Windows and Unix paths
        expanded = os.path.expandvars(file_path_field)
        candidate = Path(expanded).expanduser()

        try:
            resolved_candidate = candidate.resolve(strict=False)
        except (OSError, RuntimeError) as e:
            logger.warning(f"Failed to resolve path {candidate}: {e}")
            resolved_candidate = candidate.absolute()

        logger.info(f"Checking IFC file path: {resolved_candidate}")

        if not resolved_candidate.exists():
            return jsonify({'error': f"Provided filePath does not exist: {resolved_candidate}"}), 400

        if not resolved_candidate.is_file():
            return jsonify({'error': f"Provided filePath is not a file: {resolved_candidate}"}), 400

        if resolved_candidate.suffix.lower() != '.ifc':
            return jsonify({'error': 'Invalid file format. Only .ifc files are accepted'}), 400

        ifc_path = str(resolved_candidate)
        original_filename = request.form.get('originalFilename') or resolved_candidate.name or f"{job_id}.ifc"
        download_name = secure_filename(f"{Path(original_filename).stem or job_id}.pln")

        # Check if Node.js provided an outputPath
        requested_output_path = request.form.get('outputPath')
        if requested_output_path:
            output_path = str(Path(requested_output_path).resolve(strict=False))
            # Ensure the output directory exists
            try:
                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            except Exception as exc:
                logger.warning(f"Could not ensure output directory for job {job_id}: {exc}")
        else:
            output_path = str(_output_path(job_id, download_name))

        storage_root = str(_job_directory(job_id))

        if not plugin_ws_server.is_plugin_connected(PluginType.ARCHICAD):
            error_msg = 'Archicad plugin is not connected to Python bridge'
            logger.error(error_msg)
            _persist_job(job_id, {
                'plugin': PluginType.ARCHICAD.value,
                'status': 'error',
                'progress': 0,
                'message': error_msg,
                'ifcPath': ifc_path,
            })
            ws_client.send_error(job_id, error_msg)
            return jsonify({'error': error_msg, 'jobId': job_id}), 503

        logger.info(f"Dispatching IFC→PLN (Archicad) conversion for job {job_id}")

        _persist_job(job_id, {
            'plugin': PluginType.ARCHICAD.value,
            'status': 'queued',
            'progress': 0,
            'message': 'Using IFC file path from Node backend',
            'originalFilename': original_filename,
            'downloadName': download_name,
            'storagePath': storage_root,
            'ifcPath': ifc_path,
            'stagingStrategy': 'file-path',
        })

        ws_client.send_progress(
            job_id,
            10,
            'uploading',
            'IFC file path registered on Python bridge',
            details={
                'ifcPath': ifc_path,
                'stagingStrategy': 'file-path',
            },
        )

        _persist_job(job_id, {
            'status': 'uploading',
            'progress': 10,
            'message': 'IFC file path registered on Python bridge',
            'ifcPath': ifc_path,
            'stagingStrategy': 'file-path',
        })

        # Send IFC path as input, PLN path as output to Archicad
        dispatched = plugin_ws_server.start_archicad_conversion(
            job_id=job_id,
            ifc_path=ifc_path,  # Input is IFC
            output_path=output_path,  # Output is PLN
        )

        if not dispatched:
            error_msg = 'Failed to dispatch IFC to PLN conversion command to Archicad plugin'
            logger.error(error_msg)
            _persist_job(job_id, {
                'status': 'error',
                'progress': 0,
                'message': error_msg,
            })
            ws_client.send_error(job_id, error_msg)
            return jsonify({'error': error_msg, 'jobId': job_id}), 500

        ws_client.send_progress(
            job_id,
            20,
            'queued',
            'IFC to PLN conversion request accepted by Python bridge',
            details={
                'ifcPath': ifc_path,
                'outputPath': output_path,
                'stagingStrategy': 'file-path',
            },
        )

        _persist_job(job_id, {
            'status': 'processing',
            'progress': 20,
            'message': 'Awaiting IFC to PLN conversion on Archicad plugin',
            'ifcPath': ifc_path,
            'outputPath': output_path,
            'downloadPath': output_path,
            'downloadName': download_name,
            'storagePath': storage_root,
            'stagingStrategy': 'file-path',
        })

        return jsonify({
            'success': True,
            'jobId': job_id,
            'downloadUrl': f"/jobs/{job_id}/download",
            'message': 'IFC to PLN conversion dispatched to Archicad plugin'
        }), 202

    except Exception as e:
        error_msg = f"Server error: {str(e)}"
        logger.error(error_msg)
        return jsonify({'error': error_msg}), 500

def _serialize_job(job: Dict[str, Any]) -> Dict[str, Any]:
    payload = dict(job)
    payload['expired'] = _is_job_expired(job)
    return payload


@app.route('/jobs/<job_id>', methods=['GET'])
def get_job(job_id: str):
    job = _load_job(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404

    if _is_job_expired(job):
        _delete_job(job_id)
        return jsonify({'error': 'Job expired'}), 410

    return jsonify(_serialize_job(job)), 200


@app.route('/jobs/<job_id>/status', methods=['GET'])
def get_job_status(job_id: str):
    return get_job(job_id)


@app.route('/jobs/<job_id>/download', methods=['GET'])
def download_job_output(job_id: str):
    job = _load_job(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404

    if _is_job_expired(job):
        _delete_job(job_id)
        return jsonify({'error': 'Job expired'}), 410

    download_path = job.get('downloadPath') or job.get('outputPath')
    if not download_path:
        return jsonify({'error': 'No downloadable artifact registered for this job'}), 404

    path_obj = Path(download_path)
    if not path_obj.exists() or not path_obj.is_file():
        return jsonify({'error': 'Artifact file not found on disk'}), 404

    download_name = job.get('downloadName') or path_obj.name
    _persist_job(job_id, {'lastDownloadAt': _utc_now().isoformat()})

    return send_file(
        path_obj,
        as_attachment=True,
        download_name=download_name,
        mimetype='application/octet-stream'
    )


@app.route('/jobs/<job_id>', methods=['DELETE'])
def delete_job(job_id: str):
    job = _load_job(job_id)
    if not job:
        return jsonify({'message': 'Job already removed or never existed'}), 200

    _delete_job(job_id)
    return jsonify({'message': 'Job removed'}), 200

def on_websocket_message(message):
    """
    Callback for messages received from Node.js WebSocket
    This allows Node.js to send commands to Python (e.g., trigger Archicad conversion)
    """
    try:
        msg_type = message.get('type')

        if msg_type == 'trigger_archicad_conversion':
            # Node.js is asking Python to convert a file with Archicad
            job_id = message.get('jobId')
            file_path = message.get('filePath')

            logger.info(f"Received Archicad conversion request from Node.js: {job_id}")

            # Process conversion (this would be async in production)
            # For now, just acknowledge receipt
            ws_client.send_message({
                'type': 'archicad_conversion_received',
                'jobId': job_id,
                'status': 'queued'
            })

        elif msg_type == 'ping':
            ws_client.send_message({'type': 'pong'})

        else:
            logger.warning(f"Unknown message type from Node.js: {msg_type}")

    except Exception as e:
        logger.error(f"Error handling WebSocket message: {str(e)}")

# Set WebSocket message handler
ws_client.set_message_handler(on_websocket_message)

if __name__ == '__main__':
    # Ensure background services are running for standalone execution
    _ensure_background_services()

    # Start Flask server
    port = int(os.getenv('FLASK_PORT', 5000))
    logger.info(f"Starting Python Flask server on port {port}")

    app.run(
        host='0.0.0.0',
        port=port,
        debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    )
