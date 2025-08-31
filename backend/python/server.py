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
import archicad
from archicad import ACConnection
import os
import tempfile
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

class ArchicadService:
  def __init__(self):
    self.conn = None

  def connect(self):
    try: 
      self.conn = ACConnection.connect()
      return self.conn is not None
    
    except Exception as e:
      logging.error(f"Connection error: {e}")
      return False
  
  def convert_pln_to_ifc(self, pln_path, ifc_path):
    """Convert PLN to IFC using Archicad."""
    try:
      if not self.conn:
        raise ConnectionError("Not connected to Archicad.")
      
      open_result = self.conn.commands.OpenProject(pln_path)
      logging.info(f"Open project: {open_result}")
      
      export_params = {
        'path': ifc_path,
        'translatorIdentifier': 'IFC4',
        'ifcVersion': 'IFC4',
      }

      export_result = self.conn.commands.ExportIFC(export_params)
      logging.info(f"Export result: {export_result}")

      return True
    
    except Exception as e:
      logging.error(f"Conversion error: {e}")
      return False
    
service = ArchicadService()

@app.route('/health', methods=['GET'])
def health_check():
  """Health check endpoint."""
  
  is_connected = service.connect()
  
  return jsonify({
    'status': 'healthy' if is_connected else 'unhealthy',
    'archicad_connected': is_connected
  })

@app.route('/convert/pln-to-ifc', methods=['POST'])
def convert_pln_to_ifc():
  """Endpoint to convert PLN to IFC."""

  try:
    if 'file' not in request.files:
      return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
      return jsonify({'error': 'No file selected'}), 400
    
    with tempfile.NamedTemporaryFile(suffix='.pln', delete=False) as temp_pln:
      pln_path = temp_pln.name
      file.save(pln_path)

    ifc_path = pln_path.replace('.pln', '.ifc')

    success = service.convert_pln_to_ifc(pln_path, ifc_path)

    if success and os.path.exists(ifc_path):
      return send_file(
        ifc_path, 
        as_attachment=True,
        download_name=f"{file.filename.split('.')[0]}.ifc"
      )
    
    else:
      return jsonify({'error': 'Conversion failed'}), 500
    
  except Exception as e:
    logging.error(f"Error in conversion endpoint: {e}")
    return jsonify({'error': 'Internal server error'}), 500
  
  finally:
    try:
      if os.path.exists(pln_path):
        os.remove(pln_path)

      if os.path.exists(ifc_path):
        os.remove(ifc_path)

    except Exception as cleanup_error:
      pass

if __name__ == '__main__':
  app.run(host='0.0.0.0', port=5000, debug=True)