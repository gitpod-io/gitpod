#!/usr/bin/env bash

set -euo pipefail

usage() {
    cat <<'EOF'
Usage: scripts/update-dev-environment-image.sh [--check] <tag-or-image>

Update active dev-environment image references in .github/workflows and
.gitpod.yml. A tag such as main-gha.34488 expands to the gitpod-core-dev image.
Pass --check to verify references without changing files.
EOF
}

check=false
target=""

for argument in "$@"; do
    case "$argument" in
    --check)
        check=true
        ;;
    -h | --help)
        usage
        exit 0
        ;;
    -*)
        echo "Unknown option: $argument" >&2
        usage >&2
        exit 2
        ;;
    *)
        if [[ -n "$target" ]]; then
            echo "Only one tag or image may be provided." >&2
            usage >&2
            exit 2
        fi
        target="$argument"
        ;;
    esac
done

if [[ -z "$target" ]]; then
    usage >&2
    exit 2
fi

image_pattern='eu\.gcr\.io/gitpod-(core-dev|dev-artifact)/dev/dev-environment:[A-Za-z0-9._-]+'
if [[ "$target" != */* ]]; then
    if [[ ! "$target" =~ ^[A-Za-z0-9._-]+$ ]]; then
        echo "Invalid dev-environment tag: $target" >&2
        exit 2
    fi
    target="eu.gcr.io/gitpod-core-dev/dev/dev-environment:$target"
elif [[ ! "$target" =~ ^$image_pattern$ ]]; then
    echo "Invalid dev-environment image: $target" >&2
    exit 2
fi

search_paths=(.github/workflows .gitpod.yml)
references="$(rg --only-matching --no-filename "$image_pattern" "${search_paths[@]}" || true)"

if [[ -z "$references" ]]; then
    echo "No active dev-environment image references found." >&2
    exit 1
fi

reference_count="$(wc -l <<<"$references" | tr -d ' ')"
matching_count="$(awk -v target="$target" '$0 == target { count++ } END { print count + 0 }' <<<"$references")"
different_count=$((reference_count - matching_count))

echo "Found $reference_count active references: $matching_count target, $different_count different."

if [[ "$check" == true ]]; then
    if ((different_count > 0)); then
        echo "Active references that do not match $target:" >&2
        rg --line-number "$image_pattern" "${search_paths[@]}" | grep -Fv "$target" >&2 || true
        exit 1
    fi

    exit 0
fi

mapfile -t files < <(rg --files-with-matches "$image_pattern" "${search_paths[@]}")
TARGET_IMAGE="$target" perl -pi -e \
    's{eu\.gcr\.io/gitpod-(?:core-dev|dev-artifact)/dev/dev-environment:[A-Za-z0-9._-]+}{$ENV{TARGET_IMAGE}}g' \
    "${files[@]}"

echo "Updated $reference_count active references to $target."
