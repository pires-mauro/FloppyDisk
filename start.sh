#!/usr/bin/env bash
set -e

case "$(uname -s)" in
    Darwin*)
        open_url() { open "$1"; }
        ;;
    Linux*)
        if ! command -v xdg-open >/dev/null 2>&1; then
            echo "Could not find xdg-open. Install a desktop browser opener and try again." >&2
            exit 1
        fi
        open_url() { xdg-open "$1"; }
        ;;
    *)
        echo "Unsupported operating system: $(uname -s)" >&2
        exit 1
        ;;
esac

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

docker compose up -d --build

open_url "http://localhost:5173"
open_url "http://localhost:2424/docs"
open_url "http://localhost:8000/docs"

echo "All containers are started."
echo "Frontend:             http://localhost:5173"
echo "Critical Swagger:     http://localhost:2424/docs"
echo "Main API Swagger:     http://localhost:8000/docs"
