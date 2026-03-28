#!/usr/bin/env python3
import argparse
import base64
import json
import os
import re
import subprocess
import sys
from io import BytesIO
from PIL import Image

HEADER_SIZE = (900, 383)
SECONDARY_SIZE = (500, 500)


def crop_center(img, target_ratio):
    w, h = img.size
    current_ratio = w / h
    if current_ratio > target_ratio:
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        return img.crop((left, 0, left + new_w, h))
    new_h = int(w / target_ratio)
    top = (h - new_h) // 2
    return img.crop((0, top, w, top + new_h))


def compress_jpeg(img, target_size, max_kb=200, min_quality=60):
    img = img.resize(target_size, Image.LANCZOS)
    if img.mode != "RGB":
        img = img.convert("RGB")
    quality = 90
    while quality >= min_quality:
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        size_kb = buf.tell() / 1024
        if size_kb <= max_kb:
            return img, quality, size_kb
        quality -= 5
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=min_quality, optimize=True)
    return img, min_quality, buf.tell() / 1024


def generate_image(api_key, base_url, prompt, aspect_ratio, image_size="1K", reference_images=None):
    parts = []
    if reference_images:
        for ref_path in reference_images:
            ref_img = Image.open(ref_path)
            if ref_img.mode != "RGB":
                ref_img = ref_img.convert("RGB")
            buf = BytesIO()
            ref_img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode()
            parts.append({"inlineData": {"mimeType": "image/png", "data": b64}})
    parts.append({"text": prompt})

    body = json.dumps({
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": aspect_ratio, "imageSize": image_size}
        }
    })

    url = f"{base_url}/v1beta/models/gemini-3-pro-image-preview:generateContent"
    api_host = re.sub(r'https?://([^/:]+).*', r'\1', base_url)
    result = subprocess.run([
        "curl", "-s", "-X", "POST", url,
        "-H", f"Authorization: Bearer {api_key}",
        "-H", "Content-Type: application/json",
        "-d", body,
        "--noproxy", api_host,
        "--max-time", "180"
    ], capture_output=True, text=True)

    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        sys.exit(1)

    data = json.loads(result.stdout)
    if "error" in data:
        message = data["error"].get("message", str(data["error"]))
        print(f"Error: {message}", file=sys.stderr)
        sys.exit(1)

    candidates = data.get("candidates", [])
    if not candidates:
        print("Error: No candidates in response", file=sys.stderr)
        sys.exit(1)

    parts_resp = candidates[0].get("content", {}).get("parts", [])
    for part in parts_resp:
        inline_data = part.get("inlineData")
        if inline_data and inline_data.get("data"):
            return Image.open(BytesIO(base64.b64decode(inline_data["data"])))

    print("Error: No image data found in response", file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Generate WeChat cover image")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--type", default="header", choices=["header", "secondary"])
    parser.add_argument("--reference", action="append")
    parser.add_argument("--max-kb", type=int, default=200)
    args = parser.parse_args()

    api_key = os.environ.get("IMAGE_API_KEY")
    if not api_key:
        print("Error: IMAGE_API_KEY not set", file=sys.stderr)
        sys.exit(1)
    base_url = os.environ.get("IMAGE_BASE_URL", "https://api.laozhang.ai")

    if args.type == "header":
        gen_ratio = "16:9"
        target_size = HEADER_SIZE
        target_ratio = HEADER_SIZE[0] / HEADER_SIZE[1]
    else:
        gen_ratio = "1:1"
        target_size = SECONDARY_SIZE
        target_ratio = 1.0

    raw_image = generate_image(api_key, base_url, args.prompt, gen_ratio, reference_images=args.reference)
    cropped = crop_center(raw_image, target_ratio)
    final, quality, size_kb = compress_jpeg(cropped, target_size, max_kb=args.max_kb)

    out_dir = os.path.dirname(args.output)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir)
    final.save(args.output, format="JPEG", quality=quality, optimize=True)
    print(f"Saved: {args.output}")
    print(f"Size: {size_kb:.0f} KB (quality={quality})")


if __name__ == "__main__":
    main()
