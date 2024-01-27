#!/usr/bin/env bash
# Convenience script to create the Quality Assurance Report
#
# Usage:
#
#   report.sh [input.json]
#
# Examples
#
#   run.sh result.json
#

set -euo pipefail

input_file=${1}

d=$(date "+%Y%m%d-%H%M%S")
tempdir=$(mktemp -d /tmp/report-"$d".XXXXX)

exec {base}< <( \
  jq -r 'select( .Action | test("(pass|fail|skip)") ) | select( .Elapsed | . != 0) | select( .Test | . != null) | [.Package,.Test,.Action]|@csv' "$input_file" | \
  sed 's/github.com\/gitpod-io\/gitpod\/test\/tests\///' > "$tempdir"/base.csv
)

jq -r 'select( .Action | test("(pass|fail|skip)") ) | select( .Elapsed | . != 0) | select( .Test | . != null).Test' "$input_file" > "$tempdir"/list.txt

exec {feature}< <( \
  while read -r test_name; do
    jq -r -s --arg name "$test_name" 'map(select( . | .Test == $name) | select( . | .Output != null ) | select( .Output | startswith("===") | not) | select( .Output | contains("---") | not) | .Output | gsub("[\\n\\t]"; ""))[0]' "$input_file"
  done < "$tempdir"/list.txt | sed 's/^[ \t]*//' | sed 's/,/ /g' | cut -d ':' -f 3 > "$tempdir"/features.txt
)

exec {desc}< <( \
  while read -r test_name; do
    jq -r -s --arg name "$test_name" 'map(select( . | .Test == $name) | select( . | .Output != null ) | select( .Output | startswith("===") | not) | select( .Output | contains("---") | not) | .Output | gsub("[\\n\\t]"; ""))[1]' "$input_file"
  done < "$tempdir"/list.txt | sed 's/^[ \t]*//' | sed 's/,/ /g' | cut -d ':' -f 3 > "$tempdir"/desc.txt
)

cat <&${base}
cat <&${feature}
cat <&${desc}

paste "$tempdir"/features.txt "$tempdir"/base.csv "$tempdir"/desc.txt -d ',' | \
  awk -F"," 'OFS="," {print $3,$1,$2,$4,$5}' | \
  sed  "/null/d" |\
  sed '1iname,feature,component,status,desc'
