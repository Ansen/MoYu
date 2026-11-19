use serde::Deserialize;
use std::f64::consts::PI;
use std::fs::File;
use std::io::{BufWriter, Write};

/// 莫尔斯脉冲单元定义（毫秒级起止时间轴）
#[derive(Debug, Clone, Deserialize)]
pub struct MorsePulse {
    pub start_ms: f64,
    pub duration_ms: f64,
}

const STREAM_CHUNK_SAMPLES: usize = 4096;
const STREAM_ZERO_BYTES: [u8; STREAM_CHUNK_SAMPLES * 2] = [0u8; STREAM_CHUNK_SAMPLES * 2];

fn write_silence<W: Write>(writer: &mut W, mut count: u64) -> Result<(), String> {
    let chunk_cap = STREAM_CHUNK_SAMPLES as u64;
    while count > 0 {
        let step = count.min(chunk_cap) as usize;
        writer
            .write_all(&STREAM_ZERO_BYTES[..step * 2])
            .map_err(|e| format!("Failed to write WAV silence chunk: {e}"))?;
        count -= step as u64;
    }
    Ok(())
}

/// 流式合成并写出标准单声道 16-bit PCM WAV 文件，恒定内存占用，无 OOM 风险
pub fn write_morse_wav_file(
    path: &str,
    pulses: &[MorsePulse],
    freq: f64,
    sample_rate: u32,
    total_duration_ms: f64,
) -> Result<(), String> {
    let lower = path.to_ascii_lowercase();
    if !lower.ends_with(".wav") {
        return Err("Only .wav audio files are allowed".to_string());
    }

    let safe_sr = sample_rate.clamp(8_000, 48_000);
    let safe_freq = if freq.is_finite() {
        freq.clamp(100.0, 1_500.0)
    } else {
        400.0
    };

    let mut ordered_pulses: Vec<(f64, f64)> = pulses
        .iter()
        .filter_map(|p| {
            if p.start_ms.is_finite() && p.duration_ms.is_finite() && p.duration_ms > 0.0 {
                Some((p.start_ms.max(0.0), p.duration_ms))
            } else {
                None
            }
        })
        .collect();
    ordered_pulses.sort_by(|a, b| a.0.total_cmp(&b.0));

    let max_pulse_end_ms = ordered_pulses
        .iter()
        .map(|(s, d)| s + d)
        .fold(0.0_f64, f64::max);
    let base_total_ms = if total_duration_ms.is_finite() && total_duration_ms > 0.0 {
        total_duration_ms
    } else {
        0.0
    };
    let effective_total_ms = base_total_ms.max(max_pulse_end_ms);

    let sr_f64 = f64::from(safe_sr);
    let total_samples = ((effective_total_ms / 1000.0) * sr_f64).ceil().max(1.0) as u64;
    let data_bytes_u64 = total_samples.saturating_mul(2);
    let max_wav_data_bytes = u64::from(u32::MAX - 36);
    if data_bytes_u64 > max_wav_data_bytes {
        return Err("Audio duration exceeds the 4GB WAV RIFF file size limit".to_string());
    }

    let data_size = data_bytes_u64 as u32;
    let riff_size = 36u32 + data_size;
    let byte_rate = safe_sr * 2;

    let file = File::create(path).map_err(|e| format!("Failed to create WAV file '{path}': {e}"))?;
    let mut writer = BufWriter::with_capacity(64 * 1024, file);

    // 1. 写入标准 44 字节 RIFF/WAVE 头 (单声道 16-bit PCM)
    let mut header = [0u8; 44];
    header[0..4].copy_from_slice(b"RIFF");
    header[4..8].copy_from_slice(&riff_size.to_le_bytes());
    header[8..12].copy_from_slice(b"WAVE");
    header[12..16].copy_from_slice(b"fmt ");
    header[16..20].copy_from_slice(&16u32.to_le_bytes());
    header[20..22].copy_from_slice(&1u16.to_le_bytes());
    header[22..24].copy_from_slice(&1u16.to_le_bytes());
    header[24..28].copy_from_slice(&safe_sr.to_le_bytes());
    header[28..32].copy_from_slice(&byte_rate.to_le_bytes());
    header[32..34].copy_from_slice(&2u16.to_le_bytes());
    header[34..36].copy_from_slice(&16u16.to_le_bytes());
    header[36..40].copy_from_slice(b"data");
    header[40..44].copy_from_slice(&data_size.to_le_bytes());
    writer
        .write_all(&header)
        .map_err(|e| format!("Failed to write WAV header: {e}"))?;

    // 2. 按时间线流式输出静音段与梯形包络正弦波形
    let mut cursor_sample: u64 = 0;
    let mut pcm_buf = [0u8; STREAM_CHUNK_SAMPLES * 2];
    let angular_freq = 2.0 * PI * safe_freq / sr_f64;
    let max_ramp_samples = 0.005 * sr_f64;

    for (start_ms, duration_ms) in ordered_pulses {
        let raw_start = ((start_ms / 1000.0) * sr_f64).round() as u64;
        let raw_dur = ((duration_ms / 1000.0) * sr_f64).round().max(1.0) as u64;
        let start_sample = raw_start.max(cursor_sample).min(total_samples);
        let end_sample = raw_start.saturating_add(raw_dur).min(total_samples);

        if start_sample > cursor_sample {
            write_silence(&mut writer, start_sample - cursor_sample)?;
            cursor_sample = start_sample;
        }

        if end_sample <= cursor_sample {
            continue;
        }

        let pulse_len = end_sample - cursor_sample;
        let pulse_len_f64 = pulse_len as f64;
        let ramp = max_ramp_samples.min(pulse_len_f64 / 2.5).max(1.0);
        let mut idx: u64 = 0;

        while idx < pulse_len {
            let chunk_samples = ((pulse_len - idx) as usize).min(STREAM_CHUNK_SAMPLES);
            for slot in 0..chunk_samples {
                let sample_pos = (idx + slot as u64) as f64;
                let fade_in = (sample_pos / ramp).min(1.0);
                let fade_out = ((pulse_len_f64 - sample_pos) / ramp).min(1.0);
                let env = fade_in.min(fade_out).max(0.0);
                let sample = (0.85 * env * (sample_pos * angular_freq).sin()).clamp(-1.0, 1.0);
                let pcm = if sample < 0.0 {
                    (sample * 32768.0).floor() as i16
                } else {
                    (sample * 32767.0).floor() as i16
                };
                let bytes = pcm.to_le_bytes();
                let byte_offset = slot * 2;
                pcm_buf[byte_offset] = bytes[0];
                pcm_buf[byte_offset + 1] = bytes[1];
            }
            writer
                .write_all(&pcm_buf[..chunk_samples * 2])
                .map_err(|e| format!("Failed to write WAV PCM chunk: {e}"))?;
            idx += chunk_samples as u64;
        }

        cursor_sample = end_sample;
    }

    if cursor_sample < total_samples {
        write_silence(&mut writer, total_samples - cursor_sample)?;
    }

    writer
        .flush()
        .map_err(|e| format!("Failed to flush WAV file: {e}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_wav_path(name: &str) -> std::path::PathBuf {
        let mut p = std::env::temp_dir();
        p.push(format!("moyu_test_{}_{}.wav", std::process::id(), name));
        p
    }

    #[test]
    fn test_write_morse_wav_header_and_waveform() {
        let path = temp_wav_path("header_wave");
        let path_str = path.to_string_lossy().to_string();
        let pulses = vec![MorsePulse {
            start_ms: 100.0,
            duration_ms: 60.0,
        }];
        write_morse_wav_file(&path_str, &pulses, 600.0, 8000, 300.0)
            .expect("write_morse_wav_file should succeed");

        let bytes = std::fs::read(&path).expect("generated wav should be readable");
        let _ = std::fs::remove_file(&path);

        assert_eq!(&bytes[0..4], b"RIFF");
        assert_eq!(&bytes[8..12], b"WAVE");
        assert_eq!(&bytes[12..16], b"fmt ");
        assert_eq!(&bytes[36..40], b"data");

        // 0.3s @ 8000Hz = 2400 samples => 4800 PCM bytes + 44 header = 4844 bytes
        let expected_samples = 2400usize;
        let expected_data_size = (expected_samples * 2) as u32;
        assert_eq!(bytes.len(), 44 + expected_data_size as usize);
        assert_eq!(
            u32::from_le_bytes([bytes[40], bytes[41], bytes[42], bytes[43]]),
            expected_data_size
        );

        // 首段静音 (0..100ms => samples 0..799) 必须全为 0
        assert!(bytes[44..44 + 800 * 2].iter().all(|&b| b == 0));

        // 脉冲区间 (100..160ms => samples 800..1280) 必须包含非零波形样本
        let has_nonzero_wave = bytes[44 + 800 * 2..44 + 1280 * 2]
            .chunks_exact(2)
            .any(|c| i16::from_le_bytes([c[0], c[1]]) != 0);
        assert!(has_nonzero_wave);

        // 尾段静音 (200..300ms => samples 1600..2400) 必须全为 0
        assert!(bytes[44 + 1600 * 2..].iter().all(|&b| b == 0));
    }

    #[test]
    fn test_write_morse_wav_rejects_non_wav_extension() {
        let res = write_morse_wav_file("bad_output.txt", &[], 600.0, 44100, 100.0);
        assert!(res.is_err());
    }

    #[test]
    fn test_write_morse_wav_clamps_empty_and_out_of_bounds_params() {
        let path = temp_wav_path("clamp_empty");
        let path_str = path.to_string_lossy().to_string();
        write_morse_wav_file(&path_str, &[], 99999.0, 100, 0.0)
            .expect("empty pulses with out-of-range params should clamp cleanly");

        let bytes = std::fs::read(&path).expect("clamped empty wav should exist");
        let _ = std::fs::remove_file(&path);

        // Clamped min 8000Hz & min 1 sample => 44 + 2 = 46 bytes
        assert_eq!(bytes.len(), 46);
        assert_eq!(
            u32::from_le_bytes([bytes[24], bytes[25], bytes[26], bytes[27]]),
            8000
        );
    }
}
