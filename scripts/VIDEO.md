# EventChat product intro

## Current product launch film

```powershell
node scripts/render-product-launch.mjs --preview
node scripts/render-product-launch.mjs
```

The current film is `artifacts/videos/eventchat-product-launch-v4-camera-fullhd60.webm`: 28 seconds, 1920×1080, 60fps, with original synthesized music and synchronized sound effects (Opus). The workspace, conversation, poll and decision render the actual React components from the product. The report is the repository's `ExportSummaryModal` captured at 2× pixel density using the same three-person workshop fixture.

`scripts/product-film.tsx` owns the seven-scene choreography and native component fixtures; `scripts/product-film.css` owns the film layout. `build-product-film.mjs` bundles the project components into an offline runtime. `launch-audio.js` owns the synthesized soundtrack. The renderer saves preview frames, asset dimensions, and audio peak/RMS diagnostics alongside the film. It fixes the room clock and renders every animation frame at 60fps. No external fonts or network requests are needed.

To recapture the report from project code, run `node scripts/capture-launch-report.mjs`. Capturing the other layers through `capture-launch-assets.mjs` requires the existing local demo room and application. Keep captured assets when those services are unavailable.

Short perspective sweeps introduce the workspace, messages, poll and report. Product planes settle to a flat view for reading; the workspace and poll retain a subtle 2D push-in. Theme layers use identical camera poses and settle before the reveal.

The theme scene at 19.5–23.5 seconds reveals the native Light Mode from the navbar theme control with a circular wipe, then returns to Dark Mode. The light layer is outside the dark ancestor so it uses the project’s actual light palette.

The earlier 44-second screen-footage approach is documented below for reproducibility.

The intro uses footage of the actual local application, with a separate deterministic compositor for titles, cuts, and restrained planar motion. Presentation graphics are not part of the application's UI.

## Render the current edit

From the repository root:

```powershell
node scripts/render-cinematic-motion.mjs --preview
node scripts/render-cinematic-motion.mjs
```

Set `FFMPEG_PATH` if the bundled Playwright FFmpeg is installed elsewhere. The encoder must support MJPEG input and VP9 output.

Source: `artifacts/videos/eventchat-real-ui-source.webm` (native 1920×1080, 25fps).

Output: `artifacts/videos/eventchat-cinematic-intro.webm` (1920×1080, 60fps, 44 seconds, no audio). Titles and camera motion are rendered at 60fps; source footage retains its original temporal resolution. This is not optical-flow interpolation.

## Capture new source footage

With the local EventChat app running on port 18082:

```powershell
node scripts/record-cinematic-real-ui.mjs --raw-only
```

Use `EVENTCHAT_URL` for another local endpoint. The recorder creates a demo room and drives two demo browser sessions. Review the new footage and adjust `edits` in `cinematic-motion.html` before rendering: the source timestamps describe the current 69.8-second recording and can change after recapturing.

The preview command checks source dimensions, script errors, backwards seeking, and absence of chapter badges. It also saves representative screenshots and `motion-validation.json` for visual review.
