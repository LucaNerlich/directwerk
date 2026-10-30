#!/usr/bin/env python3
"""Build a directwerk `import_podcast_manifest` manifest from channel2mp3 output.

Expected input layout (as produced by channel2mp3.sh / yt-dlp):

    <base>/LOG.md              markdown index: "## N. Title", Uploaded, Duration, File, URL
    <base>/mp3/<slug>.mp3      audio files
    <base>/meta/<videoId>.info.json  yt-dlp metadata (title, description, upload_date, duration)
    <base>/thumbs/<videoId>.jpg      cover art

Usage:
    python3 build-manifest.py --base /path/to/show --series-slug the-karazhan-library \
        --out /tmp/manifest.json [--published-time 12:00:00Z]

The output is consumed by the MCP tool `import_podcast_manifest` in
`packages/mcp-studio` (see ../README.md#bulk-podcast-import).
"""
import argparse
import json
import os
import re
import sys

SLUG_RE = re.compile(r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?")
ENTRY_RE = re.compile(
    r"^## (?P<n>\d+)\. (?P<title>.+?)$\n\n"
    r"- Uploaded: (?P<uploaded>\d{4}-\d{2}-\d{2})$\n"
    r"- Duration: (?P<duration>\d{1,2}:\d{2}(?::\d{2})?)$\n"
    r"- File: `?mp3/(?P<file>.+?)`?$\n"
    r"- URL: <https://www\.youtube\.com/watch\?v=(?P<vid>[A-Za-z0-9_-]{11})>$",
    re.M,
)


def short_slug(slug: str) -> str:
    """Truncate at a word boundary to the API limit (64 chars)."""
    if len(slug) > 64:
        cut = slug[:64]
        slug = cut.rsplit("-", 1)[0] if "-" in cut else cut
    return slug


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", required=True, help="directory containing LOG.md, mp3/, meta/, thumbs/")
    parser.add_argument("--series-slug", required=True, help="slug of the target Directwerk series")
    parser.add_argument("--out", required=True, help="output manifest path")
    parser.add_argument("--published-time", default="12:00:00Z",
                        help="time-of-day suffix for date-only upload dates (default: 12:00:00Z)")
    args = parser.parse_args()

    log_text = open(os.path.join(args.base, "LOG.md"), encoding="utf-8").read()

    items = []
    problems = []
    for m in ENTRY_RE.finditer(log_text):
        n = int(m.group("n"))
        title = m.group("title").strip()
        uploaded = m.group("uploaded")
        mp3_rel = m.group("file")
        vid = m.group("vid")

        mp3_path = os.path.join(args.base, "mp3", mp3_rel)
        meta_path = os.path.join(args.base, "meta", f"{vid}.info.json")
        thumb_path = os.path.join(args.base, "thumbs", f"{vid}.jpg")

        missing = [p for p in (mp3_path, meta_path, thumb_path) if not os.path.isfile(p)]
        if missing:
            problems.append(f"#{n}: missing {', '.join(missing)}")
            continue

        info = json.load(open(meta_path, encoding="utf-8"))
        meta_title = (info.get("title") or "").strip()
        if meta_title != title:
            problems.append(f"#{n}: LOG title vs meta title mismatch\n  LOG: {title}\n  META: {meta_title}")

        description = (info.get("description") or "").strip()
        if not description:
            problems.append(f"#{n}: empty YouTube description")

        meta_date = info.get("upload_date")  # YYYYMMDD
        if meta_date:
            iso = f"{meta_date[:4]}-{meta_date[4:6]}-{meta_date[6:]}"
            if iso != uploaded:
                problems.append(f"#{n}: LOG uploaded {uploaded} != meta {iso}")

        slug = short_slug(os.path.splitext(mp3_rel)[0])
        if not SLUG_RE.fullmatch(slug):
            problems.append(f"#{n}: invalid slug: {slug}")

        items.append({
            "n": n,
            "videoId": vid,
            "slug": slug,
            "title": title,
            "description": description,
            "publishedAt": f"{uploaded}T{args.published_time}",
            "durationSec": info.get("duration"),
            "youtubeUrl": f"https://www.youtube.com/watch?v={vid}",
            "mp3": {
                "path": mp3_path,
                "filename": os.path.basename(mp3_rel),
                "mimeType": "audio/mpeg",
                "sizeBytes": os.path.getsize(mp3_path),
            },
            "cover": {
                "path": thumb_path,
                "filename": f"{vid}.jpg",
                "mimeType": "image/jpeg",
                "sizeBytes": os.path.getsize(thumb_path),
            },
        })

    # Slug truncation can collide; disambiguate deterministically.
    seen: dict[str, int] = {}
    for item in items:
        base = item["slug"]
        count = seen.get(base, 0)
        if count:
            item["slug"] = f"{base}-{count + 1}"
        seen[base] = count + 1

    items.sort(key=lambda it: it["n"])
    manifest = {
        "sourceDir": os.path.abspath(args.base),
        "series": {"slug": args.series_slug},
        "items": items,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)

    total = sum(it["mp3"]["sizeBytes"] for it in items)
    print(f"items={len(items)} mp3={total} bytes ({total / (1 << 30):.2f} GiB) -> {args.out}")
    if problems:
        print("\nPROBLEMS:")
        for p in problems:
            print(" -", p)
        return 1
    print("validation OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
