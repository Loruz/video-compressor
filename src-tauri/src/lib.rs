use serde::Serialize;
use std::{
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Serialize)]
struct CompressionResult {
    output_path: String,
    original_size: u64,
    compressed_size: u64,
}

#[tauri::command]
fn compress_video(input_path: String, quality: String) -> Result<CompressionResult, String> {
    let input = PathBuf::from(input_path);
    validate_input(&input)?;

    let crf = crf_for_quality(&quality)?;
    let output = compressed_output_path(&input)?;
    let original_size = file_size(&input)?;

    let ffmpeg = ffmpeg_path()?;

    let output_status = Command::new(&ffmpeg)
        .arg("-y")
        .arg("-i")
        .arg(&input)
        .args(["-c:v", "libx264"])
        .args(["-crf", crf])
        .args(["-preset", "medium"])
        .args(["-c:a", "aac"])
        .args(["-b:a", "128k"])
        .args(["-movflags", "+faststart"])
        .arg(&output)
        .output()
        .map_err(|error| format!("Could not start ffmpeg at {}: {error}", ffmpeg.display()))?;

    if !output_status.status.success() {
        let stderr = String::from_utf8_lossy(&output_status.stderr);
        return Err(format!("ffmpeg failed: {}", last_relevant_line(&stderr)));
    }

    let compressed_size = file_size(&output)?;

    Ok(CompressionResult {
        output_path: output.to_string_lossy().to_string(),
        original_size,
        compressed_size,
    })
}

fn validate_input(input: &Path) -> Result<(), String> {
    if !input.exists() {
        return Err("The selected video does not exist.".to_string());
    }

    if !input.is_file() {
        return Err("Please choose a video file, not a folder.".to_string());
    }

    Ok(())
}

fn crf_for_quality(quality: &str) -> Result<&'static str, String> {
    match quality {
        "high" => Ok("20"),
        "medium" => Ok("24"),
        "small" => Ok("28"),
        _ => Err("Unknown compression quality.".to_string()),
    }
}

fn compressed_output_path(input: &Path) -> Result<PathBuf, String> {
    let parent = input
        .parent()
        .ok_or_else(|| "Could not determine the output folder.".to_string())?;
    let stem = input
        .file_stem()
        .and_then(OsStr::to_str)
        .ok_or_else(|| "Could not read the input filename.".to_string())?;

    let mut candidate = parent.join(format!("{stem}-compressed.mp4"));
    let mut suffix = 2;

    while candidate.exists() {
        candidate = parent.join(format!("{stem}-compressed-{suffix}.mp4"));
        suffix += 1;
    }

    Ok(candidate)
}

fn file_size(path: &Path) -> Result<u64, String> {
    fs::metadata(path)
        .map(|metadata| metadata.len())
        .map_err(|error| format!("Could not read file size for {}: {error}", path.display()))
}

fn ffmpeg_path() -> Result<PathBuf, String> {
    let common_paths = [
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ];

    for path in common_paths {
        let candidate = PathBuf::from(path);
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    Ok(PathBuf::from("ffmpeg"))
}

fn last_relevant_line(stderr: &str) -> String {
    stderr
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("unknown ffmpeg error")
        .trim()
        .to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![compress_video])
        .run(tauri::generate_context!())
        .expect("error while running Tauri app");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs::{self, File},
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    static TEMP_DIR_COUNTER: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn maps_quality_to_expected_crf() {
        assert_eq!(crf_for_quality("high").unwrap(), "20");
        assert_eq!(crf_for_quality("medium").unwrap(), "24");
        assert_eq!(crf_for_quality("small").unwrap(), "28");
        assert!(crf_for_quality("tiny").is_err());
    }

    #[test]
    fn creates_non_overwriting_output_path() {
        let dir = unique_temp_dir();
        fs::create_dir_all(&dir).unwrap();

        let input = dir.join("clip.mov");
        let first_output = dir.join("clip-compressed.mp4");
        File::create(&input).unwrap();
        File::create(&first_output).unwrap();

        let output = compressed_output_path(&input).unwrap();
        assert_eq!(output, dir.join("clip-compressed-2.mp4"));

        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn compresses_a_generated_video() {
        let dir = unique_temp_dir();
        fs::create_dir_all(&dir).unwrap();

        let input = dir.join("sample.mp4");
        let ffmpeg = ffmpeg_path().expect("ffmpeg should be installed for compression tests");
        let sample_status = Command::new(ffmpeg)
            .arg("-y")
            .args(["-f", "lavfi"])
            .args(["-i", "testsrc=size=128x128:rate=15"])
            .args(["-t", "1"])
            .args(["-pix_fmt", "yuv420p"])
            .arg(&input)
            .output()
            .expect("ffmpeg should be installed for compression tests");

        assert!(
            sample_status.status.success(),
            "failed to create sample video: {}",
            String::from_utf8_lossy(&sample_status.stderr)
        );

        let result = compress_video(input.to_string_lossy().to_string(), "small".to_string())
            .expect("compression should succeed");

        assert!(Path::new(&result.output_path).exists());
        assert!(result.original_size > 0);
        assert!(result.compressed_size > 0);

        fs::remove_dir_all(dir).unwrap();
    }

    fn unique_temp_dir() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let counter = TEMP_DIR_COUNTER.fetch_add(1, Ordering::Relaxed);

        std::env::temp_dir().join(format!(
            "video-compressor-test-{}-{nanos}-{counter}",
            std::process::id()
        ))
    }
}
