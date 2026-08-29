#!/usr/bin/env python3
"""Sync directwerk-docs architecture pages from internal canonical sources."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SPECS = [
    {
        "internal": ROOT / "docs/asset-storage.md",
        "public": ROOT / "directwerk-docs/docs/architecture/asset-storage.md",
        "title": "Asset storage",
        "description": "S3-compatible storage layout, public vs private assets, upload workflow, and entitlement-gated delivery.",
    },
    {
        "internal": ROOT / "docs/payment.md",
        "public": ROOT / "directwerk-docs/docs/architecture/billing-stripe.md",
        "title": "Stripe billing",
        "description": "Stripe Connect billing status, checkout, webhooks, and studio payment integration.",
    },
]

LINK_REWRITES = [
    (r"\]\(platform-design\.md", "](../../../docs/platform-design.md"),
    (r"\]\(\.\./Directwerk/docs/media-upload-howto\.md\)[^\n]*", "](/operators/media-upload)"),
    (r"\]\(poc-alpha-setup\.md", "](/install/local-development"),
    (r"\]\(content-subscriptions-and-entitlements\.md", "](/operators/subscriptions-and-entitlements"),
    (r"\]\(content-platform-strategy\.md", "](/guide/introduction"),
]


def sync_one(spec: dict) -> None:
    body = spec["internal"].read_text()
    if body.startswith("# "):
        body = re.sub(r"^# [^\n]+\n+", "", body, count=1)
    for pattern, repl in LINK_REWRITES:
        body = re.sub(pattern, repl, body)
    src = spec["internal"].relative_to(ROOT)
    frontmatter = f"""---
title: {spec["title"]}
description: {spec["description"]}
outline: deep
---

<!-- source: {src} -->

"""
    spec["public"].write_text(frontmatter + body)
    print(f"Synced {spec['public'].relative_to(ROOT)} ({len((frontmatter + body).splitlines())} lines)")


def main() -> None:
    for spec in SPECS:
        sync_one(spec)


if __name__ == "__main__":
    main()
