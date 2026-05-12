# Video Compressor

A small macOS desktop app for compressing video files to smaller MP4s.

The app is built with Tauri: a plain HTML/CSS/JavaScript interface talks to a Rust backend, and Rust runs `ffmpeg` to do the actual video compression.

## What It Does

- Select a video with the file picker.
- Drag and drop a video onto the app window.
- Choose a compression preset:
  - High: better quality, larger output
  - Medium: balanced default
  - Small: smaller output, more quality loss
- Save the compressed video next to the original file.
- Avoid overwriting existing compressed files.
- Clear the selected file and choose another one.

Output files are named like:

```text
my-video-compressed.mp4
my-video-compressed-2.mp4
```

## Requirements

- macOS
- Rust / Cargo
- Node.js / npm
- `ffmpeg`

Install `ffmpeg` with Homebrew:

```bash
brew install ffmpeg
```

The app looks for `ffmpeg` in common macOS/Homebrew locations, including `/opt/homebrew/bin/ffmpeg`.

## Development

Install dependencies:

```bash
npm install
```

Run the app in development:

```bash
npm run tauri dev
```

Build the frontend:

```bash
npm run build
```

Check or test the Rust backend:

```bash
cd src-tauri
cargo check
cargo test
```

Build the macOS app bundle:

```bash
npm run tauri build
```

The generated app bundle is created under:

```text
src-tauri/target/release/bundle/macos/
```

## Project Structure

```text
index.html              Main app markup
src/main.js             UI behavior, file picker, drag and drop, Tauri calls
src/styles.css          App styling
src-tauri/src/lib.rs    Rust compression command and ffmpeg handling
src-tauri/tauri.conf.json
scripts/generate-icon.mjs
```

## Notes

This is intentionally a simple local utility. It does not upload videos anywhere, does not keep a database, and does not manage a queue. The current version compresses one selected file at a time.
