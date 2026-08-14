#!/usr/bin/env bash
# Directwerk — local /etc/hosts setup for dev tenant subdomains
#
# Adds host entries so *.localhost tenant domains resolve for non-browser
# clients (e.g. Linux curl, podcast apps) without relying on browser-only
# DNS special-casing.
#
# Usage:
#   ./scripts/setup-local-hosts.sh
#   or: sudo ./scripts/setup-local-hosts.sh
#
set -euo pipefail

HOSTS_FILE="/etc/hosts"
IPV4_LINE="127.0.0.1 alpha-a.localhost alpha-b.localhost"
IPV6_LINE="::1       alpha-a.localhost alpha-b.localhost"

# Check if both hosts already exist in /etc/hosts
if grep -q "alpha-a\.localhost" "$HOSTS_FILE" && grep -q "alpha-b\.localhost" "$HOSTS_FILE"; then
    echo "Directwerk dev tenant hosts are already configured in $HOSTS_FILE."
    exit 0
fi

echo "Adding Directwerk dev tenant domains to $HOSTS_FILE..."

ENTRIES=""
if ! grep -q "alpha-a\.localhost" "$HOSTS_FILE" && ! grep -q "alpha-b\.localhost" "$HOSTS_FILE"; then
    ENTRIES="${IPV4_LINE}
${IPV6_LINE}"
else
    if ! grep -q "127.0.0.1.*alpha-a\.localhost" "$HOSTS_FILE"; then
        ENTRIES="${IPV4_LINE}"
    fi
    if ! grep -q "::1.*alpha-a\.localhost" "$HOSTS_FILE"; then
        if [ -n "$ENTRIES" ]; then
            ENTRIES="${ENTRIES}
${IPV6_LINE}"
        else
            ENTRIES="${IPV6_LINE}"
        fi
    fi
fi

if [ -w "$HOSTS_FILE" ]; then
    printf "\n# Directwerk local dev tenant domains\n%s\n" "$ENTRIES" >> "$HOSTS_FILE"
else
    printf "\n# Directwerk local dev tenant domains\n%s\n" "$ENTRIES" | sudo tee -a "$HOSTS_FILE" > /dev/null
fi

echo "Done. Configured dev tenant domains:"
echo "  alpha-a.localhost"
echo "  alpha-b.localhost"
