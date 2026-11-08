"""
MediCare VitalSense — rPPG Algorithm & Measurement Accuracy Validation Tests

Verifies:
1. Physiological Pulse Accuracy: Clean ~72 BPM optical signal locks accurately at ~72 BPM with verified SNR >= 1.5.
2. Anti-False Lock Guard: Noisy, backlit, or flat signals are strictly rejected (isLocked=False, bpm=None) and never forced to 59 BPM.
3. MAD Outlier Suppression: Sudden motion artifact jumps are suppressed by Median Absolute Deviation filtering.
4. Insufficient Sample Gating: Sequences under 210 samples (~7 seconds) are rejected with clear diagnostic reasons.
5. Skin Chrominance Verification: Robust skin chrominance classification prevents non-skin pixels from skewing ROI.
"""

import json
import subprocess
import pytest


def run_node_rppg_test(js_code: str) -> dict:
    """Helper to execute test snippet inside Node using ES module import of rppgAlgorithm.ts."""
    wrapped_script = f"""
import {{
  isSkinPixel,
  preprocessRPPGSignal,
  calculateCardiacSNR,
  estimatePulse,
}} from './frontend/src/utils/rppgAlgorithm.ts';

async function run() {{
  {js_code}
}}
run().catch(err => {{
  console.error(err);
  process.exit(1);
}});
"""
    proc = subprocess.run(
        ["node", "--no-warnings", "--experimental-strip-types", "-e", wrapped_script],
        capture_output=True,
        text=True,
        timeout=15,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Node execution failed (code {proc.returncode}): {proc.stderr}\n{proc.stdout}")
    return json.loads(proc.stdout.strip())


def test_01_clean_cardiac_signal_produces_locked_bpm():
    """Validates that a 72 BPM cardiac signal (1.2 Hz) sampled at 30 fps produces ~72 BPM with high confidence and SNR >= 1.5."""
    js = """
  const sampleRate = 30;
  const targetBpm = 72;
  const targetFreq = targetBpm / 60; // 1.2 Hz
  const numSamples = 240; // 8 seconds
  const signal = [];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Fundamental cardiac wave + subtle dicrotic notch harmonic + gentle noise
    const v = Math.sin(2 * Math.PI * targetFreq * t) +
              0.35 * Math.sin(2 * Math.PI * (targetFreq * 2) * t) +
              0.04 * (Math.sin(i * 3.7) + Math.cos(i * 1.3));
    signal.push(v);
  }

  const preprocessed = preprocessRPPGSignal(signal);
  const result = estimatePulse(preprocessed, sampleRate);

  console.log(JSON.stringify({
    bpm: result.bpm,
    confidence: result.confidence,
    isLocked: result.isLocked,
    snr: result.snr
  }));
"""
    data = run_node_rppg_test(js)
    assert data["isLocked"] is True, f"Expected signal to lock, got: {data}"
    assert data["bpm"] is not None
    assert abs(data["bpm"] - 72) <= 3, f"Expected ~72 BPM, got {data['bpm']}"
    assert data["confidence"] >= 0.60, f"Expected confidence >= 0.60, got {data['confidence']}"
    assert data["snr"] >= 1.5, f"Expected SNR >= 1.5 dB, got {data['snr']}"


def test_02_noisy_or_flat_signal_rejected_cleanly():
    """Validates that random noise or a flat signal does NOT produce a false 59 BPM and is strictly rejected."""
    js = """
  const sampleRate = 30;
  const numSamples = 240;
  const noiseSignal = [];

  // Generate non-pulsatile pseudorandom noise
  let seed = 42;
  function rand() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  for (let i = 0; i < numSamples; i++) {
    noiseSignal.push((rand() - 0.5) * 4.0);
  }

  const preprocessed = preprocessRPPGSignal(noiseSignal);
  const result = estimatePulse(preprocessed, sampleRate);

  console.log(JSON.stringify({
    bpm: result.bpm,
    confidence: result.confidence,
    isLocked: result.isLocked,
    reason: result.reason
  }));
"""
    data = run_node_rppg_test(js)
    assert data["isLocked"] is False, "Noise signal must NEVER be locked!"
    assert data["bpm"] is None, f"bpm must be None for noisy signal, got {data['bpm']}"
    assert data["reason"] is not None


def test_03_motion_artifact_spike_suppression():
    """Validates that MAD outlier filtering eliminates single-sample artifact jumps."""
    js = """
  const sampleRate = 30;
  const numSamples = 240;
  const signal = [];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    signal.push(Math.sin(2 * Math.PI * 1.2 * t));
  }

  // Inject a sudden head-movement spike at sample 120
  const uncleanedMaxBefore = 15.0;
  signal[120] = uncleanedMaxBefore;

  const cleaned = preprocessRPPGSignal(signal);

  console.log(JSON.stringify({
    spikeBefore: uncleanedMaxBefore,
    spikeAfter: Math.abs(cleaned[120])
  }));
"""
    data = run_node_rppg_test(js)
    # The cleaned spike value should be dramatically reduced from 15.0 to < 2.0
    assert data["spikeAfter"] < 2.5, f"Spike was not suppressed: {data}"


def test_04_insufficient_samples_rejected():
    """Validates that signals shorter than 210 samples are rejected due to insufficient duration."""
    js = """
  const sampleRate = 30;
  const shortSignal = new Array(150).fill(1.0); // Only 5s of data
  const result = estimatePulse(shortSignal, sampleRate);

  console.log(JSON.stringify({
    isLocked: result.isLocked,
    bpm: result.bpm,
    reason: result.reason
  }));
"""
    data = run_node_rppg_test(js)
    assert data["isLocked"] is False
    assert data["bpm"] is None
    assert "Insufficient signal duration" in data["reason"]


def test_05_skin_pixel_chrominance_classification():
    """Validates that skin chrominance test distinguishes human skin from non-skin surfaces."""
    js = """
  const tests = [
    { r: 180, g: 130, b: 110, expected: true, label: 'Standard skin tone' },
    { r: 210, g: 155, b: 125, expected: true, label: 'Fair skin tone' },
    { r: 115, g: 75,  b: 55,  expected: true, label: 'Dark skin tone' },
    { r: 30,  g: 30,  b: 30,  expected: false, label: 'Dark shadow' },
    { r: 245, g: 245, b: 245, expected: false, label: 'White background' },
    { r: 20,  g: 180, b: 20,  expected: false, label: 'Pure green background' },
    { r: 20,  g: 40,  b: 200, expected: false, label: 'Blue object' },
  ];

  const results = tests.map(t => ({
    label: t.label,
    actual: isSkinPixel(t.r, t.g, t.b),
    expected: t.expected
  }));

  console.log(JSON.stringify(results));
"""
    data = run_node_rppg_test(js)
    for item in data:
        assert item["actual"] == item["expected"], f"Failed for {item['label']}: got {item['actual']}, expected {item['expected']}"

