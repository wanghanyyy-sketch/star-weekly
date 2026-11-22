#!/usr/bin/env python3
"""Cache small WebP previews of official README images on the same site origin.

All original source image URLs remain present. The site can show a project
overview when no local preview is available.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

import requests
from PIL import Image, ImageOps, UnidentifiedImageError
from update import DATA, PERIODS, write_snapshot

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "assets" / "media"
ALLOWED_HOSTS = {
    "raw.githubusercontent.com", "github.com", "user-images.githubusercontent.com",
    "private-user-images.githubusercontent.com", "media.githubusercontent.com",
    "lookaside.facebook.com", "repository-images.githubusercontent.com",
    "opengraph.githubassets.com",
}
MAX_DOWNLOAD_BYTES = 32 * 1024 * 1024
MAX_IMAGE_PIXELS = 24_000_000
MAX_OUTPUT_BYTES = 700 * 1024
MAX_IMAGES_PER_REPO = 3
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
session = requests.Session()
session.headers.update({"User-Agent": "StarScope-Image-Preview/1.0"})

def is_allowed(url: str) -> bool:
    try:
        u = urlparse(url)
        return u.scheme == "https" and u.hostname in ALLOWED_HOSTS
    except (ValueError, TypeError):
        return False

def fetch_image(url: str) -> bytes:
    if not is_allowed(url):
        raise ValueError("image origin is not allowed")
    with session.get(url, timeout=(6, 16), stream=True, allow_redirects=True) as response:
        response.raise_for_status()
        if not is_allowed(response.url):
            raise ValueError("redirect target is not an allowed image origin")
        mime = response.headers.get("content-type", "").split(";")[0].lower()
        if mime and not (mime.startswith("image/") or mime == "application/octet-stream"):
            raise ValueError("not an image")
        parts = []
        size = 0
        for piece in response.iter_content(64 * 1024):
            if piece:
                size += len(piece)
                if size > MAX_DOWNLOAD_BYTES:
                    raise ValueError("image exceeds size limit")
                parts.append(piece)
        return b"".join(parts)

def convert_webp(raw: bytes) -> bytes:
    # Convert SVGs into ordinary small preview photos before deployment.
    # Reject SVG files with active/external content.
    header = raw[:4096].lstrip().lower()
    if b"<svg" in header:
        import cairosvg

        lowered = raw.lower()
        blocked = [b"<!entity", b"<!doctype", b"<script", b"<foreignobject",
                   b'href="http', b"href='http", b'href="//', b"href='//",
                   b"url(http", b"url('http"]
        if any(item in lowered for item in blocked):
            raise ValueError("complex or externally linked SVG")
        raw = cairosvg.svg2png(bytestring=raw, output_width=1000)
    with Image.open(io.BytesIO(raw)) as source:
        frame = ImageOps.exif_transpose(source)
        frame.seek(0)
        if frame.width * frame.height > MAX_IMAGE_PIXELS:
            raise ValueError("image pixel count exceeds limit")
        frame.thumbnail((1200, 900), Image.Resampling.LANCZOS)
        if frame.mode in ("RGBA", "LA") or "transparency" in frame.info:
            rgba = frame.convert("RGBA")
            white = Image.new("RGB", rgba.size, "#ffffff")
            white.paste(rgba, mask=rgba.getchannel("A"))
            frame = white
        else:
            frame = frame.convert("RGB")
        for quality in (75, 65, 55):
            out = io.BytesIO()
            frame.save(out, "WEBP", quality=quality, method=5)
            if out.tell() <= MAX_OUTPUT_BYTES:
                return out.getvalue()
        raise ValueError("could not compress below output limit")

def cache_one(url: str) -> str | None:
    key = hashlib.sha256(url.encode("utf-8")).hexdigest()[:20]
    target = MEDIA / (key + ".webp")
    if target.exists() and target.stat().st_size > 0:
        return "./assets/media/" + target.name
    try:
        target.write_bytes(convert_webp(fetch_image(url)))
        print("Image cached:", target.name, target.stat().st_size, "bytes")
        return "./assets/media/" + target.name
    except Exception as exc:  # One malformed image must not stop publication
        print("Image skipped:", str(exc)[:100], url[:90], file=sys.stderr)
        return None

def cache_snapshot(period_name: str) -> None:
    period = PERIODS[period_name]
    doc = json.loads((DATA / period.snapshot).read_text(encoding="utf-8"))
    MEDIA.mkdir(parents=True, exist_ok=True)
    success = 0
    for repo in doc.get("repos", []):
        for shot in (repo.get("visuals") or [])[:MAX_IMAGES_PER_REPO]:
            url = shot.get("url", "")
            if not is_allowed(url):
                shot.pop("cachedUrl", None)
                continue
            local = cache_one(url)
            if local:
                shot["cachedUrl"] = local
                success += 1
            else:
                shot.pop("cachedUrl", None)
    write_snapshot(period, doc)
    print("Optimized", success, period_name, "official README image previews")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("period", nargs="?", choices=PERIODS, default="weekly")
    cache_snapshot(parser.parse_args().period)
