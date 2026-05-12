import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./styles.css";

const shell = document.querySelector(".shell");
const filePathInput = document.querySelector("#filePath");
const selectFileButton = document.querySelector("#selectFile");
const clearFileButton = document.querySelector("#clearFile");
const compressButton = document.querySelector("#compress");
const qualitySelect = document.querySelector("#quality");
const statusBox = document.querySelector("#status");

let selectedPath = "";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function setBusy(isBusy) {
  compressButton.disabled = isBusy || !selectedPath;
  selectFileButton.disabled = isBusy;
  clearFileButton.disabled = isBusy || !selectedPath;
  qualitySelect.disabled = isBusy;
  compressButton.textContent = isBusy ? "Compressing..." : "Compress video";
}

function selectVideo(path) {
  selectedPath = path;
  filePathInput.value = path;
  compressButton.disabled = false;
  clearFileButton.disabled = false;
  statusBox.className = "status";
  statusBox.textContent = "Ready to compress.";
}

function clearSelection() {
  selectedPath = "";
  filePathInput.value = "";
  compressButton.disabled = true;
  clearFileButton.disabled = true;
  statusBox.className = "status";
  statusBox.textContent = "Waiting for a video.";
}

selectFileButton.addEventListener("click", async () => {
  const file = await open({
    multiple: false,
    filters: [
      {
        name: "Videos",
        extensions: ["mp4", "mov", "m4v", "avi", "mkv", "webm"]
      }
    ]
  });

  if (!file) return;

  selectVideo(file);
});

clearFileButton.addEventListener("click", clearSelection);

getCurrentWindow().onDragDropEvent((event) => {
  if (event.payload.type === "over") {
    shell.classList.add("is-dragging");
    statusBox.className = "status";
    statusBox.textContent = "Drop the video to select it.";
    return;
  }

  shell.classList.remove("is-dragging");

  if (event.payload.type === "drop") {
    const [path] = event.payload.paths;

    if (!path) return;

    selectVideo(path);
    return;
  }

  if (!selectedPath) {
    statusBox.className = "status";
    statusBox.textContent = "Waiting for a video.";
  }
});

compressButton.addEventListener("click", async () => {
  if (!selectedPath) return;

  setBusy(true);
  statusBox.className = "status";
  statusBox.textContent = "Compressing. This can take a few minutes for large videos.";

  try {
    const result = await invoke("compress_video", {
      inputPath: selectedPath,
      quality: qualitySelect.value
    });

    const saved = result.original_size > result.compressed_size
      ? `Saved ${formatBytes(result.original_size - result.compressed_size)}.`
      : "Compression finished, though the output is not smaller than the original.";

    statusBox.className = "status success";
    statusBox.textContent = `${saved} Output: ${result.output_path}`;
  } catch (error) {
    statusBox.className = "status error";
    statusBox.textContent = String(error);
  } finally {
    setBusy(false);
  }
});
