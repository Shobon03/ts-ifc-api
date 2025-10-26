# Revit IFC Converter Plugin

C# plugin for Autodesk Revit 2025.4 that enables IFC import/export with WebSocket communication for real-time progress updates.

## Overview

This plugin provides:
- **IFC Import**: Convert `.ifc` files to Revit documents (`.rvt`)
- **IFC Export**: Convert Revit documents to `.ifc` files
- **WebSocket Server**: Real-time bidirectional communication with Node.js backend
- **Progress Updates**: Detailed conversion progress tracking
- **Job Management**: Support for concurrent conversion jobs
- **Cancellation**: Ability to cancel ongoing conversions

## Status

**Development: ~95% Complete**

✅ Implemented:
- WebSocket server with bidirectional communication
- IFC import functionality
- Progress tracking and reporting
- Job state management
- Error handling and logging
- UI status window
- Cancellation support

⚠️ To-Do:
- IFC export functionality (import only for now)
- Advanced import options (positioning, filtering)
- Unit tests
- Installer package (.msi)

## Tech Stack

```xml
<TargetFramework>net8.0-windows</TargetFramework>
<RevitVersion>2025.4</RevitVersion>
```

**Dependencies:**
- **.NET 8.0** - Framework
- **Revit API 2025.4** - Revit integration
- **WebSocketSharp** - WebSocket server
- **Newtonsoft.Json** - JSON serialization
- **RevitLookup** (dev) - Revit element inspection

## Architecture

### Components

```
IfcToRevitConverter/
├── IfcToRevitConverter.cs        # Main external command
├── WebSocketServer.cs            # WebSocket server implementation
├── ConversionHandler.cs          # Conversion logic
├── JobManager.cs                 # Job state tracking
├── ExternalEventHandler.cs       # Thread-safe Revit API access
├── StatusWindow.xaml/cs          # UI status window
└── IfcToRevitConverter.addin     # Revit add-in manifest
```

### Communication Flow

```
┌──────────────┐   WebSocket    ┌─────────────┐   ExternalEvent   ┌──────────┐
│   Node.js    │───────────────>│   Plugin    │──────────────────>│  Revit   │
│   Backend    │  (commands)    │  WebSocket  │  (thread-safe)   │   API    │
└──────────────┘                └─────────────┘                   └──────────┘
       ▲                              │
       │                              │
       └──────────────────────────────┘
            WebSocket (progress)
```

### Threading Model

Revit API requires all operations to be on the main UI thread. The plugin uses:
- **WebSocket Thread**: Receives commands from backend
- **ExternalEvent**: Marshals work to Revit UI thread
- **IExternalEventHandler**: Executes Revit API calls safely

```csharp
// WebSocket receives command
OnMessage(message) {
    var command = JsonConvert.DeserializeObject<Command>(message);
    
    // Queue work for Revit thread
    _externalEvent.Raise();
}

// External event handler executes on UI thread
Execute(UIApplication app) {
    // Now safe to use Revit API
    Document doc = app.ActiveUIDocument.Document;
    
    using (Transaction trans = new Transaction(doc)) {
        trans.Start("Import IFC");
        
        // Import IFC
        doc.Import(ifcPath, options, view);
        
        trans.Commit();
    }
}
```

## Prerequisites

### Development

- **Visual Studio 2022** (v17.8 or later)
  - Workload: ".NET desktop development"
  - Workload: "Desktop development with C++"

- **Autodesk Revit 2025.4**
  - Download from Autodesk website
  - License required

- **.NET 8.0 SDK**
  - Included with Visual Studio 2022
  - Or download from: https://dotnet.microsoft.com/

### Runtime (End User)

- **Autodesk Revit 2025.4** or later
- **Windows 10/11** (64-bit)
- **.NET 8.0 Desktop Runtime**
- **Node.js Backend** running (for communication)

## Build Instructions

### Method 1: Visual Studio (Recommended)

1. **Open Solution**
   ```
   plugins/revit/IfcToRevitConverter/IfcToRevitConverter.sln
   ```

2. **Restore NuGet Packages**
   - Right-click Solution → Restore NuGet Packages
   - Or: Build → Restore NuGet Packages

3. **Select Configuration**
   - Configuration: **Release** (or Debug for development)
   - Platform: **Any CPU**

4. **Build**
   - Build → Build Solution (Ctrl+Shift+B)

5. **Locate Output**
   ```
   plugins/revit/IfcToRevitConverter/IfcToRevitConverter/bin/Release/net8.0-windows/
   ```

### Method 2: Command Line (MSBuild)

```powershell
cd plugins\revit\IfcToRevitConverter

# Restore packages
dotnet restore

# Build
dotnet build -c Release

# Or use MSBuild directly
msbuild IfcToRevitConverter.sln /p:Configuration=Release
```

### Build Output

After successful build:
- `IfcToRevitConverter.dll` - Plugin assembly
- `IfcToRevitConverter.addin` - Add-in manifest
- `websocket-sharp.dll` - WebSocket library
- `Newtonsoft.Json.dll` - JSON library

## Installation

### Method 1: Manual Copy

1. **Locate Build Output**
   ```
   plugins\revit\IfcToRevitConverter\IfcToRevitConverter\bin\Release\net8.0-windows\
   ```

2. **Copy to Revit Add-Ins Folder**
   ```
   C:\ProgramData\Autodesk\Revit\Addins\2025\IfcToRevitConverter\
   ```

3. **Copy Files**
   - `IfcToRevitConverter.dll`
   - `IfcToRevitConverter.addin`
   - `websocket-sharp.dll`
   - `Newtonsoft.Json.dll`

4. **Edit .addin File**
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <RevitAddIns>
     <AddIn Type="Command">
       <Assembly>C:\ProgramData\Autodesk\Revit\Addins\2025\IfcToRevitConverter\IfcToRevitConverter.dll</Assembly>
       <ClientId>YOUR-GUID-HERE</ClientId>
       <FullClassName>IfcToRevitConverter.IfcConverterCommand</FullClassName>
       <Text>IFC Converter</Text>
       <Description>Import/Export IFC with WebSocket support</Description>
       <VendorId>MPTX</VendorId>
       <VendorDescription>Matheus Piovezan Teixeira</VendorDescription>
     </AddIn>
   </RevitAddIns>
   ```

5. **Start Revit**

### Method 2: Development Symlink

For faster development iteration:

```powershell
# Run as Administrator
cd C:\ProgramData\Autodesk\Revit\Addins\2025

# Create symbolic link
mklink /D IfcToRevitConverter "C:\path\to\ts-ifc-api\plugins\revit\IfcToRevitConverter\IfcToRevitConverter\bin\Release\net8.0-windows"
```

Now every rebuild automatically updates the plugin in Revit.

### Verify Installation

1. Open Revit
2. Go to: **Add-Ins** tab → **External Tools** panel
3. Look for **"IFC Converter"** button
4. Click to start WebSocket server

## Usage

### Starting the Plugin

1. Open Autodesk Revit 2025.4
2. Click **Add-Ins** → **IFC Converter**
3. Status window appears showing:
   ```
   ✅ WebSocket server started on port 8082
   ✅ Ready to receive commands
   ```

### WebSocket Protocol

**Server URL**: `ws://localhost:8082`

#### Commands (Node.js → Plugin)

```typescript
// Start IFC import
{
  "command": "start_conversion",
  "jobId": "job-123456",
  "data": {
    "input_path": "C:\\temp\\model.ifc",
    "output_path": "C:\\output\\model.rvt",
    "options": {
      "import_mode": "link",        // "link" or "import"
      "positioning": "origin"       // "origin", "shared", or "site"
    }
  }
}

// Get status
{
  "command": "get_status",
  "jobId": "job-123456"
}

// Cancel job
{
  "command": "cancel_job",
  "jobId": "job-123456"
}

// Ping
{
  "command": "ping"
}
```

#### Responses (Plugin → Node.js)

```typescript
// Connection established
{
  "type": "connection_ack",
  "message": "Revit plugin connected",
  "version": "1.0.0"
}

// Progress update
{
  "type": "progress",
  "jobId": "job-123456",
  "status": "processing",
  "progress": 45,
  "message": "Importing IFC elements...",
  "details": {
    "current_step": "import_geometry",
    "elements_processed": 150,
    "elements_total": 332
  }
}

// Completion
{
  "type": "completed",
  "jobId": "job-123456",
  "status": "completed",
  "message": "IFC imported successfully",
  "result": {
    "output_path": "C:\\output\\model.rvt",
    "file_size": 2048000,
    "elements_imported": 332
  }
}

// Error
{
  "type": "error",
  "jobId": "job-123456",
  "status": "error",
  "message": "Failed to import IFC",
  "error": "Invalid IFC file format"
}

// Pong
{
  "type": "pong"
}
```

### Testing with wscat

```bash
# Install wscat
npm install -g wscat

# Connect to plugin
wscat -c ws://localhost:8082

# Send test command
> {"command":"ping"}
< {"type":"pong"}

# Start conversion
> {"command":"start_conversion","jobId":"test-1","data":{"input_path":"C:\\test.ifc","output_path":"C:\\out.rvt"}}
< {"type":"progress","jobId":"test-1","progress":10,"message":"Starting import..."}
< {"type":"progress","jobId":"test-1","progress":50,"message":"Importing elements..."}
< {"type":"completed","jobId":"test-1","status":"completed"}
```

## Development

### Running in Debug Mode

1. **Set Revit as Debug Target**
   - Project Properties → Debug
   - Launch: Executable
   - Path: `C:\Program Files\Autodesk\Revit 2025\Revit.exe`

2. **Start Debugging** (F5)
   - Visual Studio launches Revit
   - Plugin loads automatically
   - Breakpoints work

3. **Hot Reload** (limited support)
   - Rebuild solution
   - In Revit: Close and reopen document
   - Plugin reloads

### Logging

Plugin logs to:
- **Debug Output** (Visual Studio Output window)
- **Revit Journal** (for errors)
- **Status Window** (user-visible)

Add logging:

```csharp
System.Diagnostics.Debug.WriteLine("Debug message");
TaskDialog.Show("Plugin", "User message");
```

### Debugging Tips

1. **Check Revit Journal**
   ```
   %LOCALAPPDATA%\Autodesk\Revit\Autodesk Revit 2025\Journals\
   ```

2. **Enable Detailed Logging**
   ```csharp
   #if DEBUG
       Console.WriteLine($"Processing element: {element.Name}");
   #endif
   ```

3. **Use RevitLookup**
   - Install RevitLookup from GitHub
   - Inspect Revit elements in real-time
   - Understand API behavior

## Troubleshooting

### Plugin Not Appearing in Revit

**Solutions:**
1. Check `.addin` file is in correct location
2. Verify `<Assembly>` path in `.addin`
3. Check Revit version matches (2025.4)
4. Ensure .NET 8.0 Desktop Runtime installed
5. Check Revit Journal for load errors

### WebSocket Server Won't Start

**Solutions:**
1. Check port 8082 is available:
   ```powershell
   netstat -an | findstr "8082"
   ```

2. Allow in Windows Firewall:
   ```
   Control Panel → Firewall → Advanced → Inbound Rules → New Rule
   Port: 8082, Protocol: TCP, Action: Allow
   ```

3. Run Revit as Administrator (if needed)

### IFC Import Fails

**Solutions:**
1. Verify IFC file is valid (open in IFC viewer)
2. Check file path has no special characters
3. Ensure Revit document is open
4. Check transaction is committed
5. Review Revit Journal for API errors

### Connection Drops

**Solutions:**
1. Check backend WebSocket client is alive
2. Implement ping/pong heartbeat
3. Handle reconnection in backend
4. Check network/firewall settings

### Build Errors

**"RevitAPI not found"**
- Install Revit 2025.4
- Verify NuGet packages restored
- Check Revit API reference paths

**"NET8 SDK not found"**
- Install .NET 8.0 SDK
- Restart Visual Studio
- Verify `dotnet --version` shows 8.x

## Performance

### Import Performance

| IFC Size | Elements | Import Time |
|----------|----------|-------------|
| < 5MB    | < 500    | 10-30s      |
| 5-20MB   | 500-2000 | 30-90s      |
| 20-50MB  | 2000-5000| 90-180s     |
| > 50MB   | > 5000   | 180-300s+   |

**Optimization tips:**
- Import only necessary views
- Use linking instead of importing (faster)
- Disable unnecessary categories
- Close other Revit documents

## Known Issues

1. **IFC Export Not Implemented**
   - Currently import-only
   - Use Revit built-in export for now

2. **Large File Performance**
   - Files > 100MB may timeout
   - Consider splitting model

3. **Concurrent Jobs**
   - One job at a time per Revit instance
   - Multiple instances can run parallel jobs

## Future Enhancements

- [ ] IFC export functionality
- [ ] Advanced import options (filtering, positioning)
- [ ] Batch processing (multiple files)
- [ ] Progress estimation (time remaining)
- [ ] Thumbnail generation
- [ ] Model validation before import
- [ ] Automated testing
- [ ] MSI installer

## Contributing

See [../../../README.md](../../../README.md) for contribution guidelines.

## License

GNU General Public License v3.0 or later.

See [../../../LICENSE](../../../LICENSE) for details.

## Related Documentation

- [Backend Node.js README](../../../backend/node/README.md)
- [Developer Guide](../../../documentation/content/docs/plugins/revit.mdx)
- [Revit API Documentation](https://www.revitapidocs.com/)

---

**Author**: Matheus Piovezan Teixeira  
**Repository**: [github.com/Shobon03/ts-ifc-api](https://github.com/Shobon03/ts-ifc-api)
