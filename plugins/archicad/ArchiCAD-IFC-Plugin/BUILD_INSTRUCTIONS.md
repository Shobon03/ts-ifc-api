# Archicad Plugin Build Instructions (Windows)

## Prerequisites

### 1. Development Tools
- **Visual Studio 2019** (v142 toolset)
  - Download: https://visualstudio.microsoft.com/vs/older-downloads/
  - Workloads needed: "Desktop development with C++"

- **CMake 3.16 or later**
  - Download: https://cmake.org/download/
  - Add to PATH during installation

- **Python 3.7+** (for resource compilation)
  - Download: https://www.python.org/downloads/
  - Add to PATH during installation

### 2. Archicad API DevKit
- **Archicad 28 API DevKit 28.4001**
  - Download from: https://graphisoft.com/downloads/archicad/api
  - Extract to: `C:\Program Files\GRAPHISOFT\API Development Kit 28.4001`
  - Or specify custom path later

### 3. WebSocket Dependencies (vcpkg)

Install vcpkg:
```powershell
cd C:\
git clone https://github.com/Microsoft/vcpkg.git
cd vcpkg
.\bootstrap-vcpkg.bat
.\vcpkg integrate install
```

Install Boost.Beast:
```powershell
# Install Boost.Beast (modern, secure WebSocket library)
# This automatically installs boost-asio and other dependencies
.\vcpkg install boost-beast:x64-windows

# Verify installation
.\vcpkg list | findstr boost
```

**Why Boost.Beast?**
- ✅ **Modern:** Part of Boost, actively maintained
- ✅ **Secure:** Battle-tested, used in production worldwide
- ✅ **Fast:** High-performance async I/O
- ✅ **Available:** websocketpp was removed from vcpkg
- ✅ **Well-documented:** Excellent Boost documentation

## Build Steps

### Step 1: Configure CMake

Open PowerShell or Command Prompt in the plugin directory:

```powershell
cd "C:\path\to\ts-ifc-api\plugins\archicad\ArchiCAD-IFC-Plugin"

# Create build directory
mkdir Build
cd Build
```

Configure with CMake:

```powershell
cmake .. -G "Visual Studio 16 2019" -A x64 `
  -DAC_API_DEVKIT_DIR="C:\Program Files\GRAPHISOFT\API Development Kit 28.4001" `
  -DCMAKE_TOOLCHAIN_FILE="C:\vcpkg\scripts\buildsystems\vcpkg.cmake"
```

**Expected output:**
```
-- Found Boost: 1.84.0 (or similar)
-- Boost include dir: C:/vcpkg/installed/x64-windows/include
-- Boost libraries: ...
-- WEBSOCKET_ENABLED defined
```

**Note:** Adjust paths if your installations are different:
- API DevKit path
- vcpkg installation path

### Step 2: Build the Plugin

Build in Release mode:
```powershell
cmake --build . --config Release
```

Or build in Debug mode (for development):
```powershell
cmake --build . --config Debug
```

**Build time:** ~2-5 minutes (first build)

### Step 3: Locate Output

After successful build, the plugin will be at:
```
Build\Release\ArchiCAD-IFC-Plugin.apx
```

Or for Debug:
```
Build\Debug\ArchiCAD-IFC-Plugin.apx
```

## Installation

### Method 1: Manual Installation

1. Copy the `.apx` file to Archicad's Add-On folder:
   ```
   C:\Program Files\GRAPHISOFT\ARCHICAD 28\Add-Ons\
   ```

2. Restart Archicad

3. Check if plugin appears in:
   ```
   Archicad → Options → Add-On Manager
   ```

### Method 2: Development Installation

For faster development iteration:

1. Create symbolic link:
   ```powershell
   # Run as Administrator
   cd "C:\Program Files\GRAPHISOFT\ARCHICAD 28\Add-Ons"
   mklink "ArchiCAD-IFC-Plugin.apx" "C:\path\to\Build\Release\ArchiCAD-IFC-Plugin.apx"
   ```

2. Now just rebuild, and Archicad will use the latest version

## Troubleshooting

### Error: "Boost not found"

**Solution:**
```powershell
cd C:\vcpkg
.\vcpkg install boost-beast:x64-windows
.\vcpkg integrate install
```

Then rebuild with toolchain file:
```powershell
cmake .. -G "Visual Studio 16 2019" -A x64 `
  -DCMAKE_TOOLCHAIN_FILE="C:\vcpkg\scripts\buildsystems\vcpkg.cmake"
```

### Error: "boost/beast/core.hpp not found"

**Causes:**
1. Boost not installed via vcpkg
2. CMake toolchain file not specified

**Solution:**
```powershell
# Reinstall Boost
cd C:\vcpkg
.\vcpkg install boost-beast:x64-windows

# Rebuild with toolchain file
cd path\to\Build
cmake .. -DCMAKE_TOOLCHAIN_FILE="C:\vcpkg\scripts\buildsystems\vcpkg.cmake"
cmake --build . --config Release
```

### Error: "API DevKit not found"

**Solution:**
- Verify path exists: `C:\Program Files\GRAPHISOFT\API Development Kit 28.4001`
- Check `ACAPinc.h` exists at: `Support\Inc\ACAPinc.h`
- Specify correct path in CMake command

### Error: "Python not found"

**Solution:**
- Install Python 3.7+
- Add to PATH
- Restart terminal
- Verify: `python --version`

### Error: "MSBuild failed" or "LNK errors"

**Possible causes:**
1. **Wrong Visual Studio version**
   - Plugin requires VS 2019 (v142)
   - Check: `cmake --version` and VS version

2. **Missing Windows SDK**
   - Install via Visual Studio Installer
   - Check "Windows 10 SDK" component

3. **Missing C++ toolset**
   - Install via Visual Studio Installer
   - Check "MSVC v142 - VS 2019 C++ x64/x86 build tools"

4. **Boost libraries not linked**
   - Verify CMake found Boost (check CMake output)
   - Ensure vcpkg integrate was run

### Plugin Not Appearing in Archicad

**Solutions:**
1. Check Archicad version matches API DevKit (28)
2. Verify `.apx` file in Add-Ons folder
3. Check Add-On Manager:
   ```
   Options → Add-On Manager → [Should show plugin]
   ```
4. Check for errors in Archicad's console/log

### WebSocket Server Won't Start

**Solutions:**
1. Check port 8081 is available:
   ```powershell
   netstat -an | findstr "8081"
   ```

2. Allow in Windows Firewall:
   ```
   Control Panel → Windows Defender Firewall →
   Advanced Settings → Inbound Rules → New Rule...
   Port: 8081, TCP, Allow
   ```

3. Run Archicad as Administrator (if needed)

### Boost Linking Errors

**Error:** `unresolved external symbol boost::system::...`

**Solution:**
Make sure Boost libraries are properly linked:
```powershell
# Verify Boost was found
cmake .. -G "Visual Studio 16 2019" -A x64 `
  -DCMAKE_TOOLCHAIN_FILE="C:\vcpkg\scripts\buildsystems\vcpkg.cmake"

# Look for these lines in output:
# -- Found Boost: ...
# -- Boost libraries: ...
```

If not found, reinstall:
```powershell
cd C:\vcpkg
.\vcpkg remove boost-beast:x64-windows
.\vcpkg install boost-beast:x64-windows
.\vcpkg integrate install
```

## Testing the Plugin

### 1. Start Archicad

Open Archicad 28

### 2. Check Plugin Loaded

Go to: `Options → Add-On Manager`

Look for: "ArchiCAD-IFC-Plugin"

### 3. Start WebSocket Server

In Archicad menu:
```
Your Custom Menu → Start WebSocket Server
```

Should show: "✓ WebSocket server started on port 8081"

### 4. Test Connection

From PowerShell:
```powershell
# Install wscat if needed
npm install -g wscat

# Connect to plugin
wscat -c ws://localhost:8081
```

Should show: `Connected to Archicad plugin`

### 5. Test Conversion

Send command:
```json
{
  "command": "start_conversion",
  "jobId": "test-123",
  "plnPath": "C:\\path\\to\\project.pln",
  "outputPath": "C:\\output\\test.ifc"
}
```

Should receive progress updates:
```json
{"type":"progress","jobId":"test-123","progress":10,"status":"processing","message":"Opening .pln file"}
{"type":"progress","jobId":"test-123","progress":30,"status":"processing","message":"Opening Archicad project"}
...
{"type":"completed","jobId":"test-123","status":"completed","message":"Conversion completed successfully"}
```

## Development Tips

### Fast Iteration

1. **Keep Archicad closed** while rebuilding
2. **Use Debug build** for development:
   ```powershell
   cmake --build . --config Debug
   ```
3. **Check output** in Visual Studio debugger
4. **Use logging**: `std::cout` writes to Archicad console

### Debugging

Attach Visual Studio debugger to Archicad:

1. Build in Debug mode
2. Start Archicad
3. In Visual Studio:
   ```
   Debug → Attach to Process → ARCHICAD.exe
   ```
4. Set breakpoints in your code
5. Trigger plugin actions

### Logging

Add debug output:
```cpp
#include <iostream>

std::cout << "Debug message" << std::endl;
std::cerr << "Error message" << std::endl;
```

View in Archicad's console or output window.

## Continuous Integration

For automated builds (optional):

```powershell
# Full rebuild script
cd plugins\archicad\ArchiCAD-IFC-Plugin
rmdir /s /q Build
mkdir Build
cd Build

cmake .. -G "Visual Studio 16 2019" -A x64 ^
  -DAC_API_DEVKIT_DIR="C:\Program Files\GRAPHISOFT\API Development Kit 28.4001" ^
  -DCMAKE_TOOLCHAIN_FILE="C:\vcpkg\scripts\buildsystems\vcpkg.cmake"

cmake --build . --config Release

if %ERRORLEVEL% == 0 (
    echo ✓ Build successful!
    echo Output: Build\Release\ArchiCAD-IFC-Plugin.apx
) else (
    echo ✗ Build failed!
    exit /b 1
)
```

Save as `build.bat` and run.

## Performance Notes

### Boost.Beast vs websocketpp

| Feature | Boost.Beast | websocketpp |
|---------|-------------|-------------|
| **Maintenance** | ✅ Active (Boost project) | ⚠️ Deprecated |
| **Performance** | ✅ Excellent | ✅ Good |
| **Memory Usage** | ✅ Low | ✅ Low |
| **Documentation** | ✅ Excellent | ⚠️ Limited |
| **vcpkg** | ✅ Available | ❌ Removed |
| **Security** | ✅ Audited | ⚠️ Unknown |

Boost.Beast is the recommended choice for modern C++ WebSocket applications.

## Next Steps

After successful build:

1. ✅ Install plugin in Archicad
2. ✅ Start WebSocket server from menu
3. ✅ Configure Node.js backend to connect on port 8081
4. ✅ Test end-to-end conversion flow

See [../README.md](../README.md) for integration guide.

## Support

If you encounter issues:

1. Check CMake output for warnings
2. Verify all prerequisites installed
3. Check Archicad version matches API DevKit
4. Test Boost libraries separately
5. Consult Archicad API documentation

## References

- **Archicad API Documentation**: https://archicadapi.graphisoft.com/
- **Boost.Beast**: https://www.boost.org/doc/libs/release/libs/beast/
- **Boost.Beast Examples**: https://www.boost.org/doc/libs/release/libs/beast/example/
- **vcpkg**: https://github.com/Microsoft/vcpkg
- **CMake**: https://cmake.org/documentation/

## Version History

- **v2.0** - Migrated to Boost.Beast (modern, secure)
- **v1.0** - Initial implementation (websocketpp - deprecated)
