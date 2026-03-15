# E-Manual Copilot Instructions

## Project Overview
This is a **SvelteKit-based static site** for a hospital laboratory e-manual system that catalogs laboratory tests, request forms, and sample containers. It uses **EditorJS** for rich content editing and **Lunr.js** for client-side search with ngram tokenization for partial matching.

## Architecture

### Data Model (`rawData.json`)
- **Single source of truth**: [src/routes/rawData.json](src/routes/rawData.json) (~72k lines) contains all data
- Structure: `{ config: {}, testData: [], formData: [], containerData: [] }`
- `config.editTrace[]` tracks all modifications (add/modify/remove) with timestamps
- `config.laboratories[]` and `config.alertTag[]` provide metadata for custom EditorJS tools
- Each entry uses **EditorJS block format** for rich content (header, paragraph, custom blocks)

### Route Structure
- **Dynamic routes**: `/test/[id]`, `/form/[id]`, `/container/[id]`
- All routes are **pre-rendered at build time** using `entries()` function that generates ID ranges
- Each `+page.server.js` uses `findDuplicateIds()` validation and reserves 50 future IDs beyond max
- Example: [src/routes/form/\[id\]/+page.server.js](src/routes/form/[id]/+page.server.js)

### State Management
- Svelte stores in [src/routes/stores.js](src/routes/stores.js):
  - `editedJSON`: Writable store for modified data (used in edit mode)
  - `isEditMode`, `isAdmin`, `isStaff`: Permission flags
  - `concurrentEditLock`: Prevents simultaneous edits
  - `pauseEditorRender`: Controls when EditorJS re-renders
  - `globalFunctions`: Centralized edit tracking functions (`updateEditTrace`, `removeEditTrace`)

### EditorJS Integration
- **Dynamic import** required: `const { default: EditorJS } = await import('@editorjs/editorjs')` to avoid SSR issues
- Custom block tools in `src/lib/`:
  - `alert-tag/`: Bootstrap badge alerts from config
  - `sample-container-tool/`: Container selection with image previews
  - `synonym/`: Synonym management
  - `form-link/`: Form reference linking
  - `test-form/`: Test-to-form relationship with `formRequestOnly` flag
  - `labSelectionTool/`: Lab/category selection from config
- All tools follow pattern: `static get toolbox()`, `render()`, `save()`, `validate()`
- See [src/lib/DataRow.svelte](src/lib/DataRow.svelte) lines 186-196 for initialization pattern

### Search Implementation
- **Lunr.js** with custom ngram tokenizer (lines 336-343 in [src/routes/+layout.svelte](src/routes/+layout.svelte))
- Indexes: `full_name`, `GCRS_name`, `short_name`, `synonyms`, `editType`
- Search results filter by type (test/form/container) and category code
- Index rebuilds on data changes using `$derived.by()`

### Edit Tracking System
- Located in [src/routes/+layout.svelte](src/routes/+layout.svelte) (lines 20-152)
- `updateEditTrace()`: Logs add/modify/remove with deduplication logic
  - "add" + "remove" cancel each other out
  - "add" + "modify" = no modify trace (newly added entries don't track field changes)
  - Multiple "modify" to same field updates existing trace timestamp
- `removeEditTrace()`: Clears specific modify traces (used in reset action)
- Visual indicator in DataRow when `modifyTraceExists` is true

## Development Workflows

### Build & Deploy
```bash
npm run dev          # Local development (no base path)
npm run build        # Static site generation
npm run deploy       # Build + gh-pages deployment to /emanual base path
```

### Configuration
- **Base path**: Set to `/emanual` in production via `svelte.config.js` (line 20)
- **Adapter**: `@sveltejs/adapter-static` for GitHub Pages
- **Prerender**: All routes must be prerenderable; `handleHttpError: 'fail'` enforces this

### Data Modification Pattern
1. Python scripts (e.g., [fix_qmh_forms.py](fix_qmh_forms.py)) directly edit `rawData.json`
2. Always use UTF-8 encoding: `sys.stdout.reconfigure(encoding='utf-8')`
3. Preserve EditorJS block structure when modifying nested data
4. Run validation after changes to check for duplicate IDs

## Key Conventions

### EditorJS Data Structure
All content fields use this format:
```json
{
  "blocks": [
    {
      "type": "paragraph",
      "data": { "text": "Content here" }
    }
  ]
}
```

### Dynamic Route ID Reservation
- `entries()` functions add `NUM_RESERVED_ID = 50` slots beyond current max
- Prevents 404s for newly added entries before rebuild
- Example: max ID 200 → generates routes for IDs 1-250

### Component Communication
- `DataRow.svelte` is the core editable cell component
  - Accepts props: `datatype`, `rowName`, `displayName`, `isEditable`, `entryData`
  - Each row has two holders: `rowName` (read-only) and `rowName-editable` (edit mode)
  - `concurrentEditLock` prevents multiple simultaneous edits
  - Calls `$globalFunctions.updateEditTrace()` on save

### Image Handling
- Container images stored in `src/lib/containerImages/`
- Loaded via Vite glob import with `enhanced: false` (line 6-14 in sample-container-tool.js)
- Image paths stored as IDs in data, resolved at render time

## Common Gotchas

1. **EditorJS in SSR**: Always use dynamic `import('@editorjs/editorjs')` in `onMount()`, never top-level import
2. **Store subscriptions**: Unsubscribe in `onDestroy()` to prevent memory leaks
3. **Edit trace logic**: Check for existing "add" trace before logging "modify" or "remove"
4. **Duplicate IDs**: Always run `findDuplicateIds()` after bulk data changes
5. **Base path**: Use `import { base } from '$app/paths'` for links in production
6. **Prerender entries**: Update `entries()` when adding new data types or ID ranges

## File References
- Data utilities: [src/routes/dataUtility.ts](src/routes/dataUtility.ts)
- Main layout & search: [src/routes/+layout.svelte](src/routes/+layout.svelte)
- Editable row component: [src/lib/DataRow.svelte](src/lib/DataRow.svelte)
- Static adapter config: [svelte.config.js](svelte.config.js)
