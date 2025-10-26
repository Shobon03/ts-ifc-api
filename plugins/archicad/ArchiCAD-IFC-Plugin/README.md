# Archicad IFC Converter Plugin

C++ plugin for Graphisoft Archicad 28.4 that enables IFC export with HTTP communication for integration with the BIM Interoperability System.

## Overview

This plugin provides:
- **IFC Export**: Convert Archicad projects (`.pln`) to `.ifc` files
- **HTTP API**: Communication with Python bridge server
- **Menu Integration**: Accessible from Archicad menu
- **Progress Callbacks**: Conversion progress reporting

## Status

**Development: ~65% Complete**

✅ Implemented:
- Basic Archicad API integration
- IFC export via Archicad native functionality
- CMake build system
- Menu item in Archicad
- HTTP communication structure
- Boost.Beast WebSocket foundation

⚠️ In Progress:
- WebSocket server (like Revit plugin)
- Bidirectional communication with backend
- Progress updates to Python/Node.js
- Job management

❌ To-Do:
- IFC import (`.ifc` → `.pln`)
- Advanced export options
- Real-time progress tracking
- Job cancellation
- Unit tests

## Tech Stack

```cmake
CMAKE_MINIMUM_REQUIRED(VERSION 3.16)
PROJECT(ArchiCAD-IFC-Plugin)

set(CMAKE_CXX_STANDARD 17)
set(AC_API_DEVKIT_DIR "C:/Program Files/GRAPHISOFT/API Development Kit 28.4001")
```

**Dependencies:**
- **Archicad API DevKit 28.4001** - Archicad integration
- **Visual Studio 2019** (v142) - Compiler
- **CMake 3.16+** - Build system
- **Boost.Beast** - WebSocket/HTTP (via vcpkg)
- **Python 3.7+** - Resource compilation

## Architecture

### Components

```
ArchiCAD-IFC-Plugin/
├── src/
│   ├── Main.cpp                  # Plugin entry point
│   ├── IFCExport.cpp             # IFC export logic
│   ├── MenuHandler.cpp           # Menu command handler
│   ├── HTTPServer.cpp            # HTTP communication (basic)
│   └── WebSocketServer.cpp       # WebSocket (in development)
├── Resources/
│   ├── RFIX/                     # Resource files
│   └── ResourceIDs.h             # Resource identifiers
├── CMakeLists.txt                # CMake configuration
└── BUILD_INSTRUCTIONS.md         # Detailed build guide
```

### Communication Flow (Current)

```
┌──────────┐   HTTP POST   ┌─────────┐   Python API   ┌──────────┐
│  Python  │──────────────>│ Plugin  │───────────────>│ Archicad │
│  Bridge  │  (file path)  │  HTTP   │   (AC API)     │   API    │
└──────────┘               └─────────┘                └──────────┘
     ▲                          │
     │                          │
     └──────────────────────────┘
         HTTP Response (IFC path)
```

### Communication Flow (Planned)

```
┌──────────┐   WebSocket   ┌─────────┐   AC API   ┌──────────┐
│  Node.js │◄─────────────>│ Plugin  │───────────>│ Archicad │
│  Backend │  (commands)   │   WS    │            │   API    │
└──────────┘               └─────────┘            └──────────┘
                                │
                                │ Progress
                                ▼
                           (Real-time)
```

## Prerequisites

### Development

- **Visual Studio 2019** (v142 toolset)
  - Workload: "Desktop development with C++"
  - [Download](https://visualstudio.microsoft.com/vs/older-downloads/)

- **CMake 3.16+**
  - [Download](https://cmake.org/download/)
  - Add to PATH

- **Python 3.13**
  - [Download](https://www.python.org/downloads/)
  - For resource compilation and Python bridge

- **Archicad API DevKit 28.4001**
  - [Download from Graphisoft](https://graphisoft.com/downloads/archicad/api)
  - Extract to: `C:\Program Files\GRAPHISOFT\API Development Kit 28.4001`

- **vcpkg** (for Boost.Beast)
  - See [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) for setup

### Runtime (User)

- **Graphisoft Archicad 28.4**
- **Windows 10/11** (64-bit)

## Build Instructions

**⚠️ Important**: See [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) for complete, detailed build instructions.

### Quick Build (Summary)

1. **Install vcpkg and Boost.Beast**
   ```powershell
   cd C:\
   git clone https://github.com/Microsoft/vcpkg.git
   cd vcpkg
   .\bootstrap-vcpkg.bat
   .\vcpkg integrate install
   .\vcpkg install boost-beast:x64-windows
   ```

2. **Configure with CMake**
   ```powershell
   cd plugins\archicad\ArchiCAD-IFC-Plugin
   mkdir Build
   cd Build
   
   cmake .. -G "Visual Studio 16 2019" -A x64 `
     -DAC_API_DEVKIT_DIR="C:\Program Files\GRAPHISOFT\API Development Kit 28.4001" `
     -DCMAKE_TOOLCHAIN_FILE="C:\vcpkg\scripts\buildsystems\vcpkg.cmake"
   ```

3. **Build**
   ```powershell
   cmake --build . --config Release
   ```

4. **Output**
   ```
   Build\Release\ArchiCAD-IFC-Plugin.apx
   ```

## Installation

### Manual Installation

1. **Copy Plugin**
   ```powershell
   copy Build\Release\ArchiCAD-IFC-Plugin.apx "C:\Program Files\GRAPHISOFT\ARCHICAD 28\Add-Ons\"
   ```

2. **Restart Archicad**

3. **Verify Installation**
   - Open Archicad
   - Go to: **Options → Add-On Manager**
   - Look for: "ArchiCAD-IFC-Plugin"

### Development Symlink

For faster iteration:

```powershell
# Run as Administrator
cd "C:\Program Files\GRAPHISOFT\ARCHICAD 28\Add-Ons"
mklink "ArchiCAD-IFC-Plugin.apx" "C:\path\to\Build\Release\ArchiCAD-IFC-Plugin.apx"
```

Now rebuilds automatically update the plugin.

## Usage

### Current Usage (HTTP Mode)

**Note**: Direct usage is limited. The plugin is designed to be called via the Python bridge server.

1. **Start Archicad** with plugin installed
2. **Python bridge** sends HTTP request:
   ```python
   import requests
   
   response = requests.post('http://localhost:8081/convert', json={
       'input_path': 'C:\\project.pln',
       'output_path': 'C:\\output.ifc',
       'options': {
           'ifc_version': 'IFC2x3',
           'export_geometry': True
       }
   })
   ```

3. **Plugin processes** request via Archicad API
4. **Returns** IFC file path in response

### Future Usage (WebSocket Mode)

Once WebSocket is implemented, usage will match Revit plugin:

```typescript
// Connect
const ws = new WebSocket('ws://localhost:8081')

// Send command
ws.send(JSON.stringify({
  command: 'start_conversion',
  jobId: 'job-123456',
  data: {
    input_path: 'C:\\project.pln',
    output_path: 'C:\\output.ifc'
  }
}))

// Receive progress
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log(data.progress) // 0-100
}
```

## API Reference

### Archicad API Functions Used

```cpp
// Open project
API_OpenPlanInfo openInfo;
ACAPI_Project_Open(&openInfo);

// Export IFC
API_IFCTranslatorPars pars;
pars.version = API_IFCVersion_2x3;
pars.filePath = outputPath;
ACAPI_Automate(APIDo_SaveID, &pars, nullptr);

// Close project
ACAPI_Project_Close();
```

### Menu Commands

The plugin registers a menu item:

```
Archicad Menu → File → Import and Export → Export IFC (Plugin)
```

Currently triggers a demo export.

## Development

### Project Structure

```cpp
// Main.cpp - Plugin initialization
API_AddonType __ACDLL_CALL CheckEnvironment(API_EnvirParams* envir)
{
    envir->serverInfo->AddOnDesc = "IFC Converter Plugin";
    return APIAddon_Normal;
}

GSErrCode __ACDLL_CALL RegisterInterface()
{
    // Register menu items
    ACAPI_Register_Menu(32500, 0, MenuCode_UserDef, MenuFlag_Default);
    return NoError;
}

GSErrCode __ACDLL_CALL MenuCommandHandler(const API_MenuParams* params)
{
    // Handle menu clicks
    switch (params->menuItemRef.menuResID) {
        case 32500:
            return ExportIFC();
    }
    return NoError;
}
```

### Building from Visual Studio

Alternatively to CMake command line:

1. **Generate Visual Studio Solution**
   ```powershell
   cmake .. -G "Visual Studio 16 2019" -A x64
   ```

2. **Open Solution**
   ```
   Build\ArchiCAD-IFC-Plugin.sln
   ```

3. **Build in Visual Studio**
   - Configuration: Release (or Debug)
   - Platform: x64
   - Build → Build Solution (Ctrl+Shift+B)

### Debugging

1. **Set Archicad as Debug Executable**
   - Right-click project → Properties
   - Debugging → Command: `C:\Program Files\GRAPHISOFT\ARCHICAD 28\ARCHICAD.exe`

2. **Start Debugging** (F5)
   - Visual Studio launches Archicad
   - Plugin loads automatically

3. **Add Breakpoints** in plugin code

4. **Trigger Plugin** from Archicad menu

### Logging

Add debug output:

```cpp
#include <iostream>

std::cout << "Debug message" << std::endl;
std::cerr << "Error message" << std::endl;
```

View in:
- Visual Studio Output window
- Archicad console (if available)

## Troubleshooting

### CMake Configuration Fails

**"API DevKit not found"**
- Verify path: `C:\Program Files\GRAPHISOFT\API Development Kit 28.4001`
- Check `ACAPinc.h` exists: `Support\Inc\ACAPinc.h`
- Specify correct path: `-DAC_API_DEVKIT_DIR="..."`

**"Boost not found"**
- Install via vcpkg: `.\vcpkg install boost-beast:x64-windows`
- Specify toolchain: `-DCMAKE_TOOLCHAIN_FILE="C:\vcpkg\scripts\buildsystems\vcpkg.cmake"`
- Run vcpkg integrate: `.\vcpkg integrate install`

### Build Fails

**"Python not found"**
- Install Python 3.7+
- Add to PATH
- Restart terminal

**"MSBuild errors"**
- Ensure Visual Studio 2019 (v142) installed
- Check "Desktop development with C++" workload
- Install Windows 10 SDK

**"Linking errors"**
- Verify Boost libraries found (check CMake output)
- Clean and rebuild: `rm -rf Build && mkdir Build`

### Plugin Not Loading

- Check Archicad version matches (28.4)
- Verify `.apx` in Add-Ons folder
- Check Add-On Manager for errors
- Review Archicad log files

### WebSocket Not Working

**Note**: WebSocket feature is still in development (not fully functional yet).

- Check port 8081 available
- Allow in Windows Firewall
- Run Archicad as Administrator (if needed)

## Testing

### Manual Testing

1. **Install Plugin** in Archicad
2. **Open Sample Project**
3. **Trigger Export** from menu
4. **Verify IFC** created
5. **Open IFC** in viewer (Solibri, BIMCollab, etc.)

### Integration Testing

See [../../../backend/python/README.md](../../../backend/python/README.md) for Python bridge integration tests.

## Performance

| Project Size | Elements | Export Time |
|--------------|----------|-------------|
| Small        | < 500    | 10-30s      |
| Medium       | 500-2000 | 30-90s      |
| Large        | 2000-5000| 90-180s     |
| Very Large   | > 5000   | 180s+       |

**Optimization tips:**
- Close unnecessary views before export
- Reduce detail level if appropriate
- Export only necessary zones
- Use IFC2x3 (faster than IFC4)

## Known Issues

1. **WebSocket Not Functional**
   - Still in development
   - Currently uses basic HTTP communication

2. **Limited Progress Reporting**
   - No real-time progress updates
   - User must wait for completion

3. **No Import Support**
   - Only export (`.pln` → `.ifc`)
   - Import (`.ifc` → `.pln`) not implemented

4. **Single Job at a Time**
   - One conversion per Archicad instance
   - No concurrent job support

5. **No Cancellation**
   - Cannot cancel ongoing conversion
   - Must wait for completion or force-quit

## Roadmap

### Phase 1: WebSocket Implementation (In Progress)
- [ ] WebSocket server startup
- [ ] Bidirectional communication
- [ ] Command handling
- [ ] Progress reporting

### Phase 2: Job Management
- [ ] Job ID tracking
- [ ] Status reporting
- [ ] Cancellation support
- [ ] Concurrent jobs (if possible)

### Phase 3: Advanced Features
- [ ] IFC import (`.ifc` → `.pln`)
- [ ] Export configuration options
- [ ] Validation before export
- [ ] Thumbnail generation

### Phase 4: Production Ready
- [ ] Error handling improvements
- [ ] Logging system
- [ ] Unit tests
- [ ] Documentation
- [ ] Installer

## Contributing

See [../../../README.md](../../../README.md) for contribution guidelines.

**Areas Needing Help:**
- WebSocket server implementation
- Progress callback integration
- IFC import functionality
- Testing

## License

GNU General Public License v3.0 or later.

See [../../../LICENSE](../../../LICENSE) for details.

## Related Documentation

- [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) - Detailed build guide
- [Backend Python README](../../../backend/python/README.md) - Python bridge
- [Developer Guide](../../../documentation/content/docs/plugins/archicad.mdx)
- [Archicad API Documentation](https://archicadapi.graphisoft.com/)

## Resources

- **Archicad API DevKit**: https://graphisoft.com/downloads/archicad/api
- **Archicad API Docs**: https://archicadapi.graphisoft.com/
- **Boost.Beast**: https://www.boost.org/doc/libs/release/libs/beast/
- **vcpkg**: https://github.com/Microsoft/vcpkg
- **CMake**: https://cmake.org/

---

**Author**: Matheus Piovezan Teixeira  
**Repository**: [github.com/Shobon03/ts-ifc-api](https://github.com/Shobon03/ts-ifc-api)

**Status**: Work in Progress (~65% complete)
