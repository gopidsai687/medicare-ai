import os
from PIL import Image, ImageDraw

public_dir = os.path.abspath(r"c:\MediCare AI\frontend\public")
os.makedirs(public_dir, exist_ok=True)

# 1. Master SVG
svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#071120" />
      <stop offset="50%" stop-color="#0a192f" />
      <stop offset="100%" stop-color="#0c2340" />
    </linearGradient>

    <!-- Pulse & Heart Gradient (Blue to Teal) -->
    <linearGradient id="medicareGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="35%" stop-color="#0ea5e9" />
      <stop offset="70%" stop-color="#14b8a6" />
      <stop offset="100%" stop-color="#2dd4bf" />
    </linearGradient>

    <!-- Soft Ambient Glow -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Container Base -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />
  <rect width="504" height="504" x="4" y="4" rx="108" fill="none" stroke="url(#medicareGrad)" stroke-width="3" stroke-opacity="0.3" />

  <!-- Heart Silhouette Frame -->
  <path d="M256,430 C256,430 80,315 80,195 C80,125 135,78 200,78 C232,78 248,94 256,108 C264,94 280,78 312,78 C377,78 432,125 432,195 C432,315 256,430 256,430 Z"
        fill="#0d2442"
        fill-opacity="0.45"
        stroke="url(#medicareGrad)"
        stroke-width="12"
        stroke-linejoin="round"
        stroke-linecap="round"
        stroke-opacity="0.85" />

  <!-- ECG / Pulse Line traversing through center -->
  <path d="M72,256 L152,256 L174,236 L192,256 L210,290 L248,118 L284,374 L318,242 L342,274 L358,256 L440,256"
        fill="none"
        stroke="url(#medicareGrad)"
        stroke-width="18"
        stroke-linecap="round"
        stroke-linejoin="round"
        filter="url(#glow)" />

  <!-- Pulse Peak Highlight Dot -->
  <circle cx="248" cy="118" r="8" fill="#ffffff" filter="url(#glow)" />
</svg>
"""

# Write SVG files
with open(os.path.join(public_dir, "favicon.svg"), "w", encoding="utf-8") as f:
    f.write(svg_content)
with open(os.path.join(public_dir, "icon-192.svg"), "w", encoding="utf-8") as f:
    f.write(svg_content)
with open(os.path.join(public_dir, "icon-512.svg"), "w", encoding="utf-8") as f:
    f.write(svg_content)

print("Saved SVG icons.")

# 2. Render High-Resolution Raster PNGs with PIL
def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    scale = size / 512.0
    pad = int(40 * scale) if maskable else int(16 * scale)

    # Background rounded rectangle
    radius = int((size // 2 if maskable else 96 * scale))
    draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=(10, 25, 47, 255), outline=(14, 165, 233, 120), width=max(1, int(4 * scale)))

    # Draw Heart shape
    # Sample points scaled
    heart_points = [
        (256 * scale, 410 * scale),
        (100 * scale, 290 * scale),
        (90 * scale, 190 * scale),
        (130 * scale, 100 * scale),
        (200 * scale, 100 * scale),
        (256 * scale, 150 * scale),
        (312 * scale, 100 * scale),
        (382 * scale, 100 * scale),
        (422 * scale, 190 * scale),
        (412 * scale, 290 * scale),
    ]
    draw.polygon(heart_points, fill=(15, 42, 75, 200), outline=(20, 184, 166, 220))

    # Draw ECG Pulse Line
    ecg = [
        (80 * scale, 256 * scale),
        (150 * scale, 256 * scale),
        (170 * scale, 235 * scale),
        (190 * scale, 256 * scale),
        (210 * scale, 290 * scale),
        (248 * scale, 125 * scale),
        (284 * scale, 370 * scale),
        (316 * scale, 240 * scale),
        (340 * scale, 270 * scale),
        (356 * scale, 256 * scale),
        (432 * scale, 256 * scale),
    ]
    line_w = max(2, int(16 * scale))
    draw.line(ecg, fill=(56, 189, 248, 255), width=line_w, joint="curve")

    # Peak dot
    r = max(2, int(8 * scale))
    draw.ellipse([248 * scale - r, 125 * scale - r, 248 * scale + r, 125 * scale + r], fill=(255, 255, 255, 255))

    return img

# Generate PNGs
icon192 = draw_icon(192)
icon192.save(os.path.join(public_dir, "icon-192.png"))

icon512 = draw_icon(512)
icon512.save(os.path.join(public_dir, "icon-512.png"))

icon_maskable = draw_icon(512, maskable=True)
icon_maskable.save(os.path.join(public_dir, "icon-maskable.png"))

apple_touch = draw_icon(180)
apple_touch.save(os.path.join(public_dir, "apple-touch-icon.png"))

print("Generated icon-192.png, icon-512.png, icon-maskable.png, apple-touch-icon.png successfully.")
