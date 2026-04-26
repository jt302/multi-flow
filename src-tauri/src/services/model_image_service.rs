use base64::Engine;
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, GenericImageView, ImageFormat, Rgb, RgbImage};

const MAX_MODEL_IMAGE_BYTES: usize = 350 * 1024;
const MAX_DIMENSION_KEEP_ORIGINAL: u32 = 1440;
const RESIZE_LIMITS: [u32; 3] = [1440, 1280, 1024];
const JPEG_QUALITIES: [u8; 5] = [82, 76, 70, 64, 58];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreparedModelImage {
    pub data_url: String,
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
    pub original_bytes: usize,
    pub output_bytes: usize,
    pub output_format: String,
    pub resized: bool,
    pub quality: Option<u8>,
}

pub fn prepare_image_for_model_from_bytes(
    bytes: &[u8],
    mime_hint: Option<&str>,
) -> Result<PreparedModelImage, String> {
    let decoded = image::load_from_memory(bytes).map_err(|e| format!("decode image: {e}"))?;
    let (width, height) = decoded.dimensions();
    let original_mime = resolve_mime_type(bytes, mime_hint)?;

    if width.max(height) <= MAX_DIMENSION_KEEP_ORIGINAL && bytes.len() <= MAX_MODEL_IMAGE_BYTES {
        return Ok(build_prepared(
            bytes.to_vec(),
            &original_mime,
            width,
            height,
            bytes.len(),
            false,
            None,
        ));
    }

    let mut best: Option<PreparedModelImage> = None;

    for limit in RESIZE_LIMITS {
        let resized = resize_for_limit(&decoded, limit);
        let (resized_width, resized_height) = resized.dimensions();
        let flattened = flatten_on_white(&resized);

        for quality in JPEG_QUALITIES {
            let encoded = encode_jpeg(&flattened, quality)?;
            let candidate = build_prepared(
                encoded,
                "image/jpeg",
                resized_width,
                resized_height,
                bytes.len(),
                resized_width != width || resized_height != height,
                Some(quality),
            );

            if best
                .as_ref()
                .map(|current| candidate.output_bytes < current.output_bytes)
                .unwrap_or(true)
            {
                best = Some(candidate.clone());
            }

            if candidate.output_bytes <= MAX_MODEL_IMAGE_BYTES {
                return Ok(candidate);
            }
        }
    }

    best.ok_or("no image candidate generated".to_string())
}

/// 从绝对路径读取图片并转成 PreparedModelImage（即 data URL）。
/// 用于"截图存路径，调 LLM 前临时展开"的延迟加载链路。
/// 若 mime_hint 为 None，会从文件扩展名推断（仅识别 png/jpg/jpeg/webp/gif）。
pub fn prepare_image_for_model_from_path(
    path: &str,
    mime_hint: Option<&str>,
) -> Result<PreparedModelImage, String> {
    let bytes = std::fs::read(path)
        .map_err(|e| format!("read image file '{path}': {e}"))?;
    let inferred = mime_hint.map(str::to_string).or_else(|| mime_from_path(path));
    prepare_image_for_model_from_bytes(&bytes, inferred.as_deref())
}

fn mime_from_path(path: &str) -> Option<String> {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".png") {
        Some("image/png".into())
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        Some("image/jpeg".into())
    } else if lower.ends_with(".webp") {
        Some("image/webp".into())
    } else if lower.ends_with(".gif") {
        Some("image/gif".into())
    } else {
        None
    }
}

pub fn prepare_image_for_model_from_base64(
    image_base64_or_data_url: &str,
    mime_hint: Option<&str>,
) -> Result<PreparedModelImage, String> {
    if image_base64_or_data_url.starts_with("data:") {
        let (mime_type, data) =
            split_data_url(image_base64_or_data_url).ok_or("invalid data url")?;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(data)
            .map_err(|e| format!("base64 decode: {e}"))?;
        return prepare_image_for_model_from_bytes(&bytes, Some(mime_type));
    }

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(image_base64_or_data_url)
        .map_err(|e| format!("base64 decode: {e}"))?;
    prepare_image_for_model_from_bytes(&bytes, mime_hint)
}

pub fn split_data_url(data_url: &str) -> Option<(&str, &str)> {
    let rest = data_url.strip_prefix("data:")?;
    let (meta, data) = rest.split_once(',')?;
    let mime_type = meta.strip_suffix(";base64")?;
    Some((mime_type, data))
}

fn resolve_mime_type(bytes: &[u8], mime_hint: Option<&str>) -> Result<String, String> {
    if let Some(mime) = mime_hint {
        return Ok(mime.to_string());
    }

    match image::guess_format(bytes).map_err(|e| format!("guess image format: {e}"))? {
        ImageFormat::Png => Ok("image/png".to_string()),
        ImageFormat::Jpeg => Ok("image/jpeg".to_string()),
        other => Err(format!("unsupported image format: {other:?}")),
    }
}

fn resize_for_limit(image: &DynamicImage, max_dimension: u32) -> DynamicImage {
    let (width, height) = image.dimensions();
    if width.max(height) <= max_dimension {
        return image.clone();
    }

    image.resize(max_dimension, max_dimension, FilterType::Lanczos3)
}

fn flatten_on_white(image: &DynamicImage) -> RgbImage {
    let rgba = image.to_rgba8();
    let (width, height) = rgba.dimensions();
    let mut rgb = RgbImage::new(width, height);

    for (x, y, pixel) in rgba.enumerate_pixels() {
        let alpha = pixel[3] as f32 / 255.0;
        let blended = [
            blend_channel(pixel[0], alpha),
            blend_channel(pixel[1], alpha),
            blend_channel(pixel[2], alpha),
        ];
        rgb.put_pixel(x, y, Rgb(blended));
    }

    rgb
}

fn blend_channel(value: u8, alpha: f32) -> u8 {
    let foreground = value as f32 * alpha;
    let background = 255.0 * (1.0 - alpha);
    (foreground + background).round().clamp(0.0, 255.0) as u8
}

fn encode_jpeg(image: &RgbImage, quality: u8) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut bytes, quality);
    encoder
        .encode_image(image)
        .map_err(|e| format!("encode jpeg: {e}"))?;
    Ok(bytes)
}

fn build_prepared(
    bytes: Vec<u8>,
    mime_type: &str,
    width: u32,
    height: u32,
    original_bytes: usize,
    resized: bool,
    quality: Option<u8>,
) -> PreparedModelImage {
    let output_bytes = bytes.len();
    let data_url = format!(
        "data:{};base64,{}",
        mime_type,
        base64::engine::general_purpose::STANDARD.encode(&bytes)
    );
    PreparedModelImage {
        data_url,
        mime_type: mime_type.to_string(),
        width,
        height,
        original_bytes,
        output_bytes,
        output_format: mime_type
            .strip_prefix("image/")
            .unwrap_or("png")
            .to_string(),
        resized,
        quality,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba};

    fn encode_png(width: u32, height: u32, alpha: u8) -> Vec<u8> {
        let img = ImageBuffer::from_fn(width, height, |_x, _y| Rgba([20, 40, 200, alpha]));
        let mut bytes = Vec::new();
        DynamicImage::ImageRgba8(img)
            .write_to(&mut std::io::Cursor::new(&mut bytes), ImageFormat::Png)
            .expect("encode png");
        bytes
    }

    fn encode_jpeg(width: u32, height: u32) -> Vec<u8> {
        let img = ImageBuffer::from_fn(width, height, |_x, _y| Rgba([180, 100, 40, 255]));
        let mut bytes = Vec::new();
        DynamicImage::ImageRgba8(img)
            .write_to(&mut std::io::Cursor::new(&mut bytes), ImageFormat::Jpeg)
            .expect("encode jpeg");
        bytes
    }

    #[test]
    fn keeps_small_image_format_when_under_budget() {
        let bytes = encode_png(320, 200, 255);

        let prepared =
            prepare_image_for_model_from_bytes(&bytes, Some("image/png")).expect("prepare");

        assert_eq!(prepared.mime_type, "image/png");
        assert_eq!(prepared.output_format, "png");
        assert_eq!(prepared.output_bytes, bytes.len());
        assert!(!prepared.resized);
        assert_eq!(prepared.quality, None);
    }

    #[test]
    fn compresses_large_png_into_budgeted_jpeg() {
        let bytes = encode_png(2200, 1600, 255);

        let prepared =
            prepare_image_for_model_from_bytes(&bytes, Some("image/png")).expect("prepare");

        assert_eq!(prepared.mime_type, "image/jpeg");
        assert_eq!(prepared.output_format, "jpeg");
        assert!(prepared.output_bytes <= 350 * 1024);
        assert!(prepared.width <= 1440);
        assert!(prepared.height <= 1440);
        assert!(prepared.resized);
        assert!(prepared.quality.is_some());
    }

    #[test]
    fn flattens_transparent_png_before_jpeg_encoding() {
        let bytes = encode_png(1800, 1200, 120);

        let prepared =
            prepare_image_for_model_from_bytes(&bytes, Some("image/png")).expect("prepare");

        assert_eq!(prepared.mime_type, "image/jpeg");
        assert!(prepared.output_bytes > 0);
    }

    #[test]
    fn prepare_from_path_reads_disk_and_infers_mime() {
        let bytes = encode_jpeg(320, 200);
        let dir = std::env::temp_dir().join("multi-flow-test-mis");
        std::fs::create_dir_all(&dir).expect("mkdir");
        let p = dir.join("shot.jpg");
        std::fs::write(&p, &bytes).expect("write");

        let prepared = prepare_image_for_model_from_path(p.to_str().unwrap(), None)
            .expect("prepare from path");
        assert_eq!(prepared.mime_type, "image/jpeg");
        assert!(prepared.data_url.starts_with("data:image/jpeg;base64,"));

        std::fs::remove_file(&p).ok();
    }

    #[test]
    fn prepare_from_path_reports_io_error_when_missing() {
        let err = prepare_image_for_model_from_path("/nonexistent/__no__.png", None)
            .err()
            .unwrap();
        assert!(err.contains("read image file"));
    }

    #[test]
    fn preserves_data_url_mime_when_under_budget() {
        let bytes = encode_jpeg(400, 200);
        let data_url = format!(
            "data:image/jpeg;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(bytes)
        );

        let prepared = prepare_image_for_model_from_base64(&data_url, None).expect("prepare");

        assert_eq!(prepared.mime_type, "image/jpeg");
        assert!(prepared.data_url.starts_with("data:image/jpeg;base64,"));
    }
}
