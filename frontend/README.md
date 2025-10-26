# Frontend - React Web Application

Modern web interface for the BIM Interoperability System.

## Overview

This is the user-facing web application that provides:
- File upload and conversion management
- Real-time progress tracking via WebSocket
- Internationalization (Portuguese and English)
- Responsive design with dark mode support
- Chain conversions (e.g., Revit → IFC → Archicad)

## Tech Stack

```json
{
  "react": "19.2.0",
  "@tanstack/react-router": "1.133.28",
  "@tanstack/react-query": "5.90.5",
  "tailwindcss": "4.1.16",
  "vite": "7.1.7",
  "typescript": "5.7.3",
  "react-hook-form": "7.65.0",
  "zod": "4.1.12",
  "lucide-react": "0.548.0"
}
```

## Project Structure

```
frontend/
├── src/
│   ├── main.tsx                          # Entry point with WebSocketProvider
│   ├── routes/                           # File-based routing (TanStack Router)
│   │   ├── __root.tsx                    # Root layout with navbar
│   │   ├── index.tsx                     # Home page with canvas effect
│   │   ├── about.tsx                     # About page
│   │   ├── model-generation.tsx          # Simple conversion (file → IFC)
│   │   ├── model-transformation.tsx      # Chain conversions
│   │   └── model-validation.tsx          # Validation (TODO)
│   ├── components/
│   │   ├── ifc-generation.tsx            # IFC generation component
│   │   ├── model-transformation.tsx      # Transformation logic
│   │   ├── conversion-progress.tsx       # Progress display
│   │   ├── websocket-status.tsx          # WebSocket connection indicator
│   │   ├── plugin-status-indicator.tsx   # Plugin status (Revit/Archicad)
│   │   └── ui/                           # Reusable UI components
│   │       ├── button.tsx
│   │       ├── dropzone.tsx
│   │       ├── input.tsx
│   │       ├── form.tsx
│   │       └── ... (other components)
│   ├── lib/
│   │   ├── websocket.ts                  # useWebSocket hook
│   │   ├── websocket-context.tsx         # WebSocketProvider (global state)
│   │   ├── websocket-types.ts            # WebSocket type definitions
│   │   ├── config.ts                     # Environment configuration
│   │   ├── utils.ts                      # Utility functions (cn, etc.)
│   │   └── i18n/
│   │       ├── translator.ts             # Translation utilities
│   │       └── messages.json             # Portuguese/English messages
│   └── assets/
│       └── css/
│           └── index.css                 # Global styles + Tailwind
├── public/                               # Static assets
├── dist/                                 # Build output (after build)
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── package.json
```

## Key Features

### 1. File-Based Routing (TanStack Router)

All routes are automatically generated from files in `src/routes/`:

| Route | File | Description |
|-------|------|-------------|
| `/` | `index.tsx` | Home page with interactive canvas |
| `/about` | `about.tsx` | About the project |
| `/model-generation` | `model-generation.tsx` | Simple conversions (Revit/Archicad → IFC) |
| `/model-transformation` | `model-transformation.tsx` | Chain conversions (e.g., Revit → IFC → Archicad) |
| `/model-validation` | `model-validation.tsx` | IFC validation (not yet implemented) |

### 2. WebSocket Context Provider

Global WebSocket state management:

```tsx
// main.tsx
<WebSocketProvider wsUrl='ws://localhost:3000/models/ws/conversion'>
  <RouterProvider router={router} />
</WebSocketProvider>
```

**Features:**
- ✅ Single shared WebSocket connection
- ✅ Automatic reconnection (up to 5 attempts, 3s interval)
- ✅ Global jobs Map with real-time updates
- ✅ Subscribe/unsubscribe to job updates
- ✅ Visual connection status indicator

**Usage in components:**

```tsx
import { useWebSocket } from '@/lib/websocket'

function MyComponent() {
  const { jobs, subscribe, isConnected } = useWebSocket()

  useEffect(() => {
    subscribe(jobId)
  }, [jobId])

  const job = jobs.get(jobId)
  console.log(job?.progress) // 0-100
}
```

### 3. Internationalization (i18n)

Support for Portuguese (pt-BR) and English (en-US):

```typescript
import { translate, translateBackendMessage } from '@/lib/i18n/translator'

// Translate UI keys
translate('conversion.uploading') // "Enviando arquivo..."

// Translate backend messages
translateBackendMessage('File uploaded successfully') // "Arquivo enviado com sucesso"

// Translate job status
translateJobStatus('processing') // "Processando"
```

Language is stored in `localStorage` and can be toggled in the UI.

### 4. Conversion Flows

#### Simple Conversion (`/model-generation`)

```
User uploads .rvt or .pln
    ↓
POST /models/generate-ifc
    ↓
Receives jobId
    ↓
WebSocket subscribes to job
    ↓
Real-time progress updates (0-100%)
    ↓
Download IFC when complete
```

#### Chain Conversion (`/model-transformation`)

```
User uploads .rvt and selects .pln as target
    ↓
Step 1: POST /models/generate-ifc (.rvt → .ifc)
    ↓
Monitors jobId1 via WebSocket
    ↓
When jobId1 completes:
    ↓
Step 2: POST /models/convert-from-ifc (.ifc → .pln)
    ↓
Monitors jobId2 via WebSocket
    ↓
Download .pln when jobId2 completes
```

### 5. Real-Time Progress Display

The `ConversionProgress` component shows:
- ✅ Progress bar (0-100%)
- ✅ Status message (translated)
- ✅ Current step/plugin in use
- ✅ File details (name, size)
- ✅ Download button when complete
- ✅ Error messages if failed

### 6. Plugin Status Monitoring

`PluginStatusIndicator` shows real-time plugin connectivity:
- 🟢 **Revit: Connected** - Plugin is ready
- 🔴 **Revit: Disconnected** - Plugin not available
- 🟢 **Archicad: Connected** - Plugin is ready
- 🔴 **Archicad: Disconnected** - Plugin not available

### 7. Dark Mode

Toggle between light and dark themes:
- Theme persisted in `localStorage`
- Tailwind CSS dark mode classes
- Smooth transitions

### 8. Drag-and-Drop File Upload

Custom dropzone component:
- Drag and drop files
- Click to select files
- File validation (type, size)
- Visual feedback on hover

## Environment Variables

Create a `.env` file in `frontend/`:

```env
# Backend API URL
VITE_BACKEND_URL=http://localhost:3000

# WebSocket URL
VITE_WS_URL=ws://localhost:3000/models/ws/conversion

# Environment
VITE_ENV=development
```

## Development

### Install Dependencies

```bash
pnpm install
```

### Run Development Server

```bash
pnpm dev
```

Application starts at: **http://localhost:3001**

Features:
- ⚡ Hot Module Replacement (HMR)
- 🔄 Fast refresh
- 🎨 Instant CSS updates

### Type Checking

```bash
pnpm type-check
```

### Linting

```bash
pnpm lint
```

Uses Biome for fast linting and formatting.

## Production

### Build

```bash
pnpm build
```

Output: `dist/` directory with optimized static files.

**Build optimizations:**
- Code splitting
- Tree shaking
- Minification
- Asset optimization

### Preview Build

```bash
pnpm preview
```

Serves the production build locally for testing.

### Deploy

The `dist/` folder can be deployed to:
- **Vercel** (recommended for Next.js-like experience)
- **Netlify**
- **AWS S3 + CloudFront**
- **GitHub Pages**
- Any static hosting service

**Important**: Configure the hosting service to:
1. Serve `index.html` for all routes (SPA routing)
2. Set correct CORS headers for API calls
3. Enable gzip/brotli compression

## Architecture

### Component Hierarchy

```
App (main.tsx)
└── WebSocketProvider
    └── RouterProvider
        └── Root Layout (__root.tsx)
            ├── Navbar
            │   ├── Navigation Links
            │   ├── WebSocket Status
            │   └── Theme Toggle
            └── Outlet (page content)
                ├── Home (/)
                ├── About (/about)
                ├── Model Generation (/model-generation)
                │   ├── IfcGeneration Component
                │   ├── PluginStatusIndicator
                │   └── ConversionProgress
                └── Model Transformation (/model-transformation)
                    ├── ModelTransformation Component
                    ├── PluginStatusIndicator
                    └── Multiple ConversionProgress
```

### State Management

1. **Global WebSocket State** (Context API)
   - Jobs Map: `Map<jobId, ConversionJob>`
   - Connection status
   - Subscription management

2. **Local Component State** (useState)
   - File selection
   - Form inputs
   - UI toggles

3. **Server State** (TanStack Query) - Minimal usage
   - Currently not heavily used
   - Can be expanded for API caching

### WebSocket Message Flow

```
┌──────────┐                      ┌──────────┐
│ Frontend │                      │  Backend │
│          │──────subscribe──────>│          │
│          │       (jobId)        │          │
│          │                      │          │
│          │◄─────progress────────│          │
│          │   (0%, 10%, 20%...)  │          │
│          │                      │          │
│          │◄─────completed───────│          │
│          │  (100%, download URL)│          │
└──────────┘                      └──────────┘
```

## Components Reference

### Core Components

#### `<IfcGeneration />`
Located: `src/components/ifc-generation.tsx`

Handles simple file → IFC conversion:
- File upload (drag-and-drop or click)
- File validation (.rvt, .pln, max 100MB)
- POST to `/models/generate-ifc`
- WebSocket subscription
- Progress display

#### `<ModelTransformation />`
Located: `src/components/model-transformation.tsx`

Handles chain conversions:
- Upload source file (.rvt, .pln, or .ifc)
- Select target format(s)
- Sequential or parallel conversion
- Multiple progress tracking

#### `<ConversionProgress />`
Located: `src/components/conversion-progress.tsx`

Displays conversion progress:
- Progress bar with percentage
- Status messages (translated)
- Current step indicator
- Plugin information
- Download button when complete
- Error display if failed

Props:
```typescript
interface ConversionProgressProps {
  jobId: string
}
```

#### `<WebSocketStatus />`
Located: `src/components/websocket-status.tsx`

Shows WebSocket connection status:
- 🟢 Connected
- 🟡 Reconnecting (attempt N/5)
- 🔴 Disconnected

#### `<PluginStatusIndicator />`
Located: `src/components/plugin-status-indicator.tsx`

Displays plugin availability:
- Revit plugin status
- Archicad plugin status
- Color-coded indicators

### UI Components

All located in `src/components/ui/`:

- `<Button />` - Various button styles and sizes
- `<Dropzone />` - File drag-and-drop area
- `<Input />` - Form input fields
- `<Label />` - Form labels
- `<Form />` - Form wrapper with validation
- `<NavLink />` - Active navigation links

Built with:
- **Tailwind CSS** for styling
- **Class Variance Authority (CVA)** for variants
- **Radix UI** primitives for accessibility

## Hooks

### `useWebSocket()`

Access global WebSocket state:

```typescript
const {
  isConnected,      // boolean
  jobs,             // Map<string, ConversionJob>
  subscribe,        // (jobId: string) => void
  unsubscribe,      // (jobId: string) => void
  send,             // (message: object) => void
  reconnect         // () => void
} = useWebSocket()
```

## Styling

### Tailwind CSS

Configuration: `tailwind.config.ts`

Custom theme:
- Primary color: Blue
- Dark mode support
- Responsive breakpoints
- Custom animations

### Global Styles

Located: `src/assets/css/index.css`

Includes:
- Tailwind directives
- CSS custom properties for theming
- Global resets

## Testing

### Manual Testing Checklist

- [ ] Home page loads and canvas animates
- [ ] Navigation works (all routes accessible)
- [ ] File upload (drag-and-drop and click)
- [ ] File validation (wrong format shows error)
- [ ] WebSocket connects (green indicator)
- [ ] Progress updates in real-time
- [ ] Download works when conversion completes
- [ ] Chain conversion executes in sequence
- [ ] Plugin status indicators update
- [ ] Language toggle works
- [ ] Dark mode toggle works
- [ ] Responsive on mobile

### Browser Compatibility

Tested on:
- ✅ Chrome 120+
- ✅ Firefox 120+
- ✅ Edge 120+
- ✅ Safari 17+

## Troubleshooting

### WebSocket Won't Connect

1. Check backend is running: `curl http://localhost:3000/health`
2. Verify WebSocket URL in `.env`
3. Check browser console for errors
4. Ensure CORS is configured correctly in backend

### File Upload Fails

1. Check file size (max 100MB)
2. Verify file extension (.rvt, .pln, .ifc)
3. Check network tab for API errors
4. Ensure backend is accepting multipart/form-data

### Progress Stuck at 0%

1. Check WebSocket is connected (green indicator)
2. Verify job was created (check network tab)
3. Ensure plugin is running (check plugin status)
4. Check backend logs for errors

### Build Fails

1. Clear cache: `rm -rf node_modules dist && pnpm install`
2. Check Node version: `node --version` (should be >=18)
3. Verify all dependencies installed
4. Check TypeScript errors: `pnpm type-check`

### Hot Reload Not Working

1. Restart dev server
2. Check Vite config
3. Ensure file watcher is not at limit (Linux): `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p`

## Performance

### Bundle Size

Typical production build:
- Main bundle: ~150KB (gzipped)
- Vendor chunks: ~200KB (gzipped)
- Total: ~350KB (gzipped)

### Optimization Tips

1. **Code splitting**: Already implemented via TanStack Router
2. **Lazy loading**: Use `React.lazy()` for heavy components
3. **Image optimization**: Use WebP format, compress images
4. **Caching**: Configure aggressive caching for static assets

## Contributing

See [../README.md](../README.md) for contribution guidelines.

## License

GNU General Public License v3.0 or later.

See [../LICENSE](../LICENSE) for details.

## Related Documentation

- [Backend Node.js README](../backend/node/README.md)
- [Backend Python README](../backend/python/README.md)
- [Developer Guide](../documentation/content/docs/developer-guide/frontend.mdx)
- [User Guide](../documentation/content/docs/user-guide/getting-started.mdx)

---

**Author**: Matheus Piovezan Teixeira  
**Repository**: [github.com/Shobon03/ts-ifc-api](https://github.com/Shobon03/ts-ifc-api)
