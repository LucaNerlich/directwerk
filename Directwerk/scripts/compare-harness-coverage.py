#!/usr/bin/env python3
"""Compare Bruno vs HTTP test harness coverage."""

import json
import re
from pathlib import Path
from collections import defaultdict

BRUNO_ROOT = Path("/workspace/Directwerk/bruno")
HTTP_ROOT = Path("/workspace/Directwerk/http")

UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I
)
VAR_RE = re.compile(r"\{\{[^}]+\}\}")
METHOD_BLOCK_RE = re.compile(r"^(get|post|patch|put|delete)\s*\{", re.I)
HTTP_METHOD_LINE_RE = re.compile(
    r"^(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)\s+(\S+)", re.I
)


def normalize_path(path: str, *, include_query: bool = False) -> str:
    """Normalize URL to method-matching pattern (path-only by default)."""
    if not path:
        return ""
    path = re.sub(r"^\{\{baseUrl\}\}", "", path, flags=re.I)
    path = re.sub(r"^\{\{[^}]+\}\}", "", path)
    if not path.startswith("/"):
        if "://" in path:
            idx = path.find("/", path.find("://") + 3)
            path = path[idx:] if idx >= 0 else path
        else:
            path = "/" + path

    base, _, query = path.partition("?")
    base = VAR_RE.sub("{param}", base)
    base = UUID_RE.sub("{uuid}", base)
    base = re.sub(r"/\d+(?=/|$)", "/{id}", base)
    base = re.sub(r"/+$", "", base) or "/"

    if not include_query or not query:
        return base

    parts = []
    for pair in sorted(query.split("&")):
        if "=" in pair:
            k, _, v = pair.partition("=")
            v_norm = "{param}" if VAR_RE.search(v) or UUID_RE.search(v) else v
            parts.append(f"{k}={v_norm}")
        else:
            parts.append(pair)
    return base + "?" + "&".join(parts)


def bruno_folder_path(filepath: Path) -> str:
    rel = filepath.relative_to(BRUNO_ROOT)
    parts = list(rel.parts[:-1])
    # Skip numbered prefix for grouping? Keep full path for report
    return "/".join(parts)


def parse_bru(filepath: Path) -> dict | None:
    text = filepath.read_text(encoding="utf-8", errors="replace")
    name = filepath.stem
    m = re.search(r"^\s*name:\s*(.+)$", text, re.M)
    if m:
        name = m.group(1).strip()
    else:
        # compact meta: meta { name: Foo type: http seq: 1 }
        cm = re.search(r"meta\s*\{[^}]*\bname:\s*([^}\n]+?)(?:\s+type:|\s+seq:|\s*\})", text)
        if cm:
            name = cm.group(1).strip()

    method = None
    url = None

    # Compact single-line: post { url: ... body: none auth: inherit }
    compact = re.search(
        r"^(get|post|patch|put|delete)\s*\{\s*url:\s*(\S+)",
        text,
        re.I | re.M,
    )
    if compact:
        method = compact.group(1).upper()
        url = compact.group(2).strip()
    else:
        for line in text.splitlines():
            mm = METHOD_BLOCK_RE.match(line.strip())
            if mm:
                method = mm.group(1).upper()
                continue
            if method and url is None:
                um = re.match(r"^\s*url:\s*(.+)$", line)
                if um:
                    url = um.group(1).strip()
                    break

    if not method or not url:
        return None

    return {
        "source": "bruno",
        "file": str(filepath.relative_to(BRUNO_ROOT.parent)),
        "folder": bruno_folder_path(filepath),
        "name": name,
        "method": method,
        "url_raw": url,
        "path_norm": normalize_path(url),
    }


def parse_http_file(filepath: Path) -> list[dict]:
    text = filepath.read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"\n###\s*\n", text)
    requests = []
    current_name = None

    for block in blocks:
        lines = block.strip().splitlines()
        if not lines:
            continue

        for line in lines:
            nm = re.match(r"^###\s*@name\s+(\S+)", line)
            if nm:
                current_name = nm.group(1)
                continue
            im = re.match(r"^@name\s+(\S+)", line.strip())
            if im:
                current_name = im.group(1)

        req_name = current_name
        method = None
        url = None
        for line in lines:
            line = line.strip()
            if line.startswith("#") or line.startswith(">"):
                continue
            hm = HTTP_METHOD_LINE_RE.match(line)
            if hm:
                method = hm.group(1).upper()
                url = hm.group(2).strip()
                if not req_name:
                    req_name = f"(unnamed in {filepath.name})"
                requests.append(
                    {
                        "source": "http",
                        "file": filepath.name,
                        "folder": "",
                        "name": req_name,
                        "method": method,
                        "url_raw": url,
                        "path_norm": normalize_path(url),
                    }
                )
                req_name = None
                current_name = None
                method = None
                url = None

    return requests


# Feature area mapping for Bruno folders
BRUNO_AREA_MAP = {
    "01-Auth-and-Tokens": "Auth & OAuth2",
    "02-Me": "Me / Subscriber",
    "03-Public": "Public site",
    "04-RSS-Feeds": "RSS feeds",
    "05-Security-and-Probes": "Security & probes",
    "06-Platform-Admin": "Platform admin",
    "07-Tenant-Admin": "Tenant admin",
    "08-Media": "Media upload",
    "09-Podcast-Content": "Podcast content",
    "10-Health-and-Docs": "Health & docs",
    "11-Articles": "Articles",
    "12-Webhooks": "Webhooks",
    "13-Custom-Feeds": "Custom feeds",
}

HTTP_AREA_MAP = {
    "01-health.http": "Health & docs",
    "02-oauth2.http": "Auth & OAuth2",
    "03-auth.http": "Auth & OAuth2",
    "04-me.http": "Me / Subscriber",
    "05-public.http": "Public site",
    "06-platform-tenants.http": "Platform admin",
    "07-platform-modules.http": "Platform admin",
    "08-platform-admins.http": "Platform admin",
    "09-platform-tenant-users.http": "Platform admin",
    "10-tenant-admin.http": "Tenant admin",
    "11-tenant-products.http": "Tenant admin",
    "12-tenant-subscriptions.http": "Tenant admin",
    "13-module-probes.http": "Security & probes",
    "14-security-probes.http": "Security & probes",
    "15-multi-tenant-isolation.http": "Security & probes",
    "16-platform-audit.http": "Platform admin",
    "17-media-upload.http": "Media upload",
    "18-platform-tenant-media.http": "Platform admin",
    "19-podcast-content.http": "Podcast content",
    "20-episode-stream.http": "Me / Subscriber",
    "21-public-rss.http": "RSS feeds",
    "22-private-rss.http": "RSS feeds",
    "23-entitlements.http": "Tenant admin",
    "24-articles.http": "Articles",
    "25-tenant-subscriber-feeds.http": "Tenant admin",
    "26-stripe-billing.http": "Stripe / billing",
    "27-custom-feeds.http": "Custom feeds",
    "28-platform-queue.http": "Platform admin",
}


def bruno_area(folder: str) -> str:
    top = folder.split("/")[0] if folder else "unknown"
    sub = folder.split("/")[1] if "/" in folder else ""
    base = BRUNO_AREA_MAP.get(top, top)
    if top == "06-Platform-Admin" and sub:
        return f"Platform admin — {sub}"
    if top == "07-Tenant-Admin" and sub:
        return f"Tenant admin — {sub}"
    if top == "09-Podcast-Content" and sub:
        return f"Podcast content — {sub}"
    if top == "05-Security-and-Probes" and sub:
        return f"Security & probes — {sub}"
    return base


def suggest_http_file(req: dict) -> str:
    """Suggest HTTP file for a missing Bruno request."""
    p = req["path_norm"]
    m = req["method"]
    folder = req["folder"]

    # Explicit path-based routing
    rules = [
        (r"^/actuator", "01-health.http"),
        (r"^/v3/api-docs|^/swagger", "01-health.http"),
        (r"^/oauth2", "02-oauth2.http"),
        (r"^/api/v1/auth", "03-auth.http"),
        (r"^/api/v1/me/feeds/custom", "27-custom-feeds.http"),
        (r"^/api/v1/me/feeds", "22-private-rss.http"),
        (r"^/api/v1/me/episodes|^/api/v1/me/downloads", "20-episode-stream.http"),
        (r"^/api/v1/me/(subscriptions|checkout|portal|notifications|access|articles)", "04-me.http"),
        (r"^/api/v1/me$", "04-me.http"),
        (r"^/api/v1/public", "05-public.http"),
        (r"^/api/v1/platform/overview", "28-platform-overview.http (NEW)"),
        (r"^/api/v1/platform/queue", "29-platform-queue.http (NEW)"),
        (r"^/api/v1/platform/audit", "16-platform-audit.http"),
        (r"^/api/v1/platform/admins", "08-platform-admins.http"),
        (r"^/api/v1/platform/modules", "07-platform-modules.http"),
        (r"^/api/v1/platform/tenants/.+/media", "18-platform-tenant-media.http"),
        (r"^/api/v1/platform/tenants/.+/users", "09-platform-tenant-users.http"),
        (r"^/api/v1/platform/tenants/.+/modules", "07-platform-modules.http"),
        (r"^/api/v1/platform/tenants", "06-platform-tenants.http"),
        (r"^/api/v1/tenant/branding|^/api/v1/tenant/domains|^/api/v1/tenant/users|^/api/v1/tenant/content-email", "10-tenant-admin.http"),
        (r"^/api/v1/tenant/products", "11-tenant-products.http"),
        (r"^/api/v1/tenant/subscriptions|^/api/v1/tenant/subscribers", "12-tenant-subscriptions.http"),
        (r"^/api/v1/tenant/subscriber-feeds", "25-tenant-subscriber-feeds.http"),
        (r"^/api/v1/tenant/stripe|^/api/v1/stripe", "26-stripe-billing.http"),
        (r"^/api/v1/probes/modules", "13-module-probes.http"),
        (r"^/api/v1/probes/security", "14-security-probes.http"),
        (r"^/api/v1/media", "17-media-upload.http"),
        (r"^/api/v1/tenant/(series|episodes|formats|categories)", "19-podcast-content.http"),
        (r"^/api/v1/articles", "24-articles.http"),
        (r"^/feeds/|^/rss/", "21-public-rss.http or 22-private-rss.http"),
        (r"webhook", "26-stripe-billing.http"),
    ]
    for pattern, target in rules:
        if re.search(pattern, p, re.I):
            return target

    top = folder.split("/")[0] if folder else ""
    fallback = {
        "01-Auth-and-Tokens": "02-oauth2.http or 03-auth.http",
        "02-Me": "04-me.http",
        "03-Public": "05-public.http",
        "04-RSS-Feeds": "21-public-rss.http or 22-private-rss.http",
        "05-Security-and-Probes": "13-module-probes.http / 14-security-probes.http / 15-multi-tenant-isolation.http",
        "06-Platform-Admin": "06-platform-tenants.http (or area-specific)",
        "07-Tenant-Admin": "10-tenant-admin.http (or area-specific)",
        "08-Media": "17-media-upload.http",
        "09-Podcast-Content": "19-podcast-content.http",
        "10-Health-and-Docs": "01-health.http",
        "11-Articles": "24-articles.http",
        "12-Webhooks": "26-stripe-billing.http",
        "13-Custom-Feeds": "27-custom-feeds.http",
    }
    return fallback.get(top, "TBD — review 00-index.http")


def suggest_bru_folder(req: dict) -> str:
    """Suggest Bruno folder for a missing HTTP request."""
    p = req["path_norm"]
    rules = [
        (r"^/actuator|^/v3/api-docs", "10-Health-and-Docs"),
        (r"^/oauth2", "01-Auth-and-Tokens"),
        (r"^/api/v1/auth", "01-Auth-and-Tokens"),
        (r"^/api/v1/me/feeds/custom", "13-Custom-Feeds"),
        (r"^/api/v1/me", "02-Me"),
        (r"^/api/v1/public", "03-Public"),
        (r"^/api/v1/platform/overview", "06-Platform-Admin/Overview"),
        (r"^/api/v1/platform/queue", "06-Platform-Admin/Queue"),
        (r"^/api/v1/platform/audit", "06-Platform-Admin/Audit"),
        (r"^/api/v1/platform/admins", "06-Platform-Admin/Admins"),
        (r"^/api/v1/platform/modules", "06-Platform-Admin/Modules"),
        (r"^/api/v1/platform/tenants/.+/media", "06-Platform-Admin/Tenant-Media"),
        (r"^/api/v1/platform/tenants/.+/users", "06-Platform-Admin/Tenant-Users"),
        (r"^/api/v1/platform/tenants", "06-Platform-Admin/Tenants"),
        (r"^/api/v1/tenant/branding", "07-Tenant-Admin/Branding"),
        (r"^/api/v1/tenant/domains", "07-Tenant-Admin/Domains"),
        (r"^/api/v1/tenant/users", "07-Tenant-Admin/Users"),
        (r"^/api/v1/tenant/content-email", "07-Tenant-Admin/Content-Email-Templates"),
        (r"^/api/v1/tenant/products", "07-Tenant-Admin/Products"),
        (r"^/api/v1/tenant/subscriptions|^/api/v1/tenant/subscribers", "07-Tenant-Admin/Subscriptions"),
        (r"^/api/v1/tenant/subscriber-feeds", "07-Tenant-Admin/Subscriptions"),
        (r"^/api/v1/tenant/stripe", "07-Tenant-Admin/Stripe"),
        (r"^/api/v1/probes/modules", "05-Security-and-Probes"),
        (r"^/api/v1/probes/security", "05-Security-and-Probes"),
        (r"^/api/v1/media", "08-Media"),
        (r"^/api/v1/tenant/domains/.+/verify", "07-Tenant-Admin/Domains"),
        (r"^/api/v1/tenant/(series|episodes|formats|categories)", "09-Podcast-Content"),
        (r"^/api/v1/articles", "11-Articles"),
        (r"webhook", "12-Webhooks"),
        (r"^/feeds/", "04-RSS-Feeds"),
    ]
    for pattern, target in rules:
        if re.search(pattern, p, re.I):
            return target
    return HTTP_AREA_MAP.get(req["file"], "TBD")


def main():
    bruno_requests = []
    for fp in sorted(BRUNO_ROOT.rglob("*.bru")):
        if fp.name == "folder.bru":
            continue
        if "environments" in fp.parts:
            continue
        if fp.name in ("collection.bru",):
            continue
        parsed = parse_bru(fp)
        if parsed:
            bruno_requests.append(parsed)

    http_requests = []
    for fp in sorted(HTTP_ROOT.glob("*.http")):
        if fp.name == "00-index.http":
            # index has healthSmoke only
            pass
        http_requests.extend(parse_http_file(fp))

    # Build indexes: method+path -> list of requests
    bruno_index = defaultdict(list)
    http_index = defaultdict(list)
    for r in bruno_requests:
        key = (r["method"], r["path_norm"])
        bruno_index[key].append(r)
    for r in http_requests:
        key = (r["method"], r["path_norm"])
        http_index[key].append(r)

    bruno_keys = set(bruno_index.keys())
    http_keys = set(http_index.keys())

    bruno_only_keys = bruno_keys - http_keys
    http_only_keys = http_keys - bruno_keys

    bruno_only = []
    for key in sorted(bruno_only_keys):
        for r in bruno_index[key]:
            bruno_only.append({**r, "key": key})

    http_only = []
    for key in sorted(http_only_keys):
        for r in http_index[key]:
            http_only.append({**r, "key": key})

    # Folder/file existence gaps
    bruno_subfolders = set()
    for fp in BRUNO_ROOT.rglob("*"):
        if fp.is_dir() and fp.name != "environments":
            rel = fp.relative_to(BRUNO_ROOT)
            if len(rel.parts) >= 2:
                bruno_subfolders.add(str(rel))

    http_files = {f.name for f in HTTP_ROOT.glob("*.http") if f.name != "00-index.http"}

    # Structural gaps: Bruno areas without HTTP counterpart
    structural = {
        "bruno_folders_without_http_file": [],
        "http_files_without_bruno_folder": [],
    }

    bruno_top_areas = {
        "12-Webhooks": "partial in 26-stripe-billing.http",
    }
    for folder, note in bruno_top_areas.items():
        structural["bruno_folders_without_http_file"].append({"folder": folder, "note": note})

    http_without_dedicated_bruno = []
    for hf, area in HTTP_AREA_MAP.items():
        if hf == "00-index.http":
            continue
        # Check if any bruno folder covers this
        covered = False
        for bf, ba in BRUNO_AREA_MAP.items():
            if ba.split(" — ")[0] == area.split(" — ")[0]:
                covered = True
                break
        if not covered and "platform-overview" not in hf and "platform-queue" not in hf:
            if hf in ():
                continue  # split files merged into parent
            http_without_dedicated_bronu = area

    # Group gaps by feature area
    def group_by_area(items, source):
        groups = defaultdict(list)
        for item in items:
            if source == "bruno":
                area = bruno_area(item["folder"])
            else:
                area = HTTP_AREA_MAP.get(item["file"], item["file"])
            groups[area].append(item)
        return dict(sorted(groups.items()))

    report = {
        "summary": {
            "bruno_request_count": len(bruno_requests),
            "http_request_count": len(http_requests),
            "bruno_unique_method_path": len(bruno_keys),
            "http_unique_method_path": len(http_keys),
            "matched_method_path": len(bruno_keys & http_keys),
            "bruno_only_method_path": len(bruno_only_keys),
            "http_only_method_path": len(http_only_keys),
            "bruno_only_request_entries": len(bruno_only),
            "http_only_request_entries": len(http_only),
        },
        "structural_gaps": structural,
        "bruno_only_by_area": group_by_area(bruno_only, "bruno"),
        "http_only_by_area": group_by_area(http_only, "http"),
    }

    # Print human-readable report
    print("=" * 80)
    print("DIRECTWERK API TEST HARNESS GAP REPORT")
    print("Bruno: Directwerk/bruno/  |  HTTP: Directwerk/http/")
    print("=" * 80)
    s = report["summary"]
    print(f"\n## Summary\n")
    print(f"| Metric | Count |")
    print(f"|--------|------:|")
    for k, v in s.items():
        label = k.replace("_", " ").title()
        print(f"| {label} | {v} |")

    print("\n## 3. Structural / File-Level Gaps\n")
    print("### Bruno feature areas with no dedicated HTTP file\n")
    for item in structural["bruno_folders_without_http_file"]:
        print(f"- **{item['folder']}** → {item['note']}")

    print("\n### HTTP files with no matching Bruno top-level folder\n")
    http_bronu_map = {
        "20-episode-stream.http": "Bruno: 02-Me (Stream Episode, List My Episodes/Downloads)",
        "23-entitlements.http": "Bruno: 07-Tenant-Admin/Products (access rules)",
        "25-tenant-subscriber-feeds.http": "Bruno: 07-Tenant-Admin/Subscriptions (feeds subset)",
        "26-stripe-billing.http": "Bruno: 07-Tenant-Admin/Stripe + 02-Me checkout/portal + 12-Webhooks",
    }
    for hf, note in sorted(http_bruno_map.items()):
        print(f"- **{hf}** — {note}")

    print("\n## 1. Bruno Requests Missing from HTTP (by method + normalized path)\n")
    for area, items in report["bruno_only_by_area"].items():
        print(f"\n### {area} ({len(items)})\n")
        for item in sorted(items, key=lambda x: (x["folder"], x["name"])):
            suggest = suggest_http_file(item)
            print(f"- **{item['name']}**")
            print(f"  - Bruno: `{item['folder']}/{Path(item['file']).name}`")
            print(f"  - `{item['method']} {item['path_norm']}`")
            print(f"  - Raw: `{item['url_raw']}`")
            print(f"  - → Add to: **{suggest}**")
            print()

    print("\n## 2. HTTP Requests Missing from Bruno (by method + normalized path)\n")
    for area, items in report["http_only_by_area"].items():
        print(f"\n### {area} ({len(items)})\n")
        for item in sorted(items, key=lambda x: (x["file"], x["name"])):
            suggest = suggest_bru_folder(item)
            print(f"- **{item['name']}**")
            print(f"  - HTTP: `{item['file']}`")
            print(f"  - `{item['method']} {item['path_norm']}`")
            print(f"  - Raw: `{item['url_raw']}`")
            print(f"  - → Add to Bruno: **{suggest}**")
            print()

    # Also dump JSON for machine use
    json_path = Path("/workspace/Directwerk/scripts/harness-gap-report.json")
    # Convert tuples in keys for JSON
    def serialize(items):
        out = []
        for item in items:
            d = dict(item)
            if "key" in d:
                d["key"] = list(d["key"])
            out.append(d)
        return out

    json_out = {
        "summary": report["summary"],
        "structural_gaps": report["structural_gaps"],
        "bruno_only": serialize(bruno_only),
        "http_only": serialize(http_only),
    }
    json_path.write_text(json.dumps(json_out, indent=2), encoding="utf-8")
    print(f"\n(JSON written to {json_path})")


if __name__ == "__main__":
    main()
