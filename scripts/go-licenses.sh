#!/bin/sh

if [ "A$GITHUB_TOKEN" = "A" ]; then
    echo "Please set the GITHUB_TOKEN env var to a personal access token. Otherwise this script won't work."
    exit 1
fi

cd "$(dirname "$0")/.." || exit
out=$PWD

tmpdir=$(mktemp -d)
(cd "$tmpdir" || exit; curl -L https://github.com/mitchellh/golicense/releases/download/v0.2.0/golicense_0.2.0_linux_x86_64.tar.gz | tar xzv)
golicense="$tmpdir"/golicense

cd "components" || exit
for i in *; do
    echo "trying $i"
    if [ -f "$i/go.mod" ]; then
        echo "building $i"
        cd "$i" || exit
        go build -o exec

        echo "checking $i"
        timeout 60 "$golicense" -plain -license=true exec >> "$out/licenses.$i.txt"
        rm exec
        cd - || exit
    fi
done
cd ..

cat licenses.*.txt | sort | tr -s ' ' | uniq | sed -r 's/\s+/,/' | column -s , -t > "$out"/License.third-party.go.txt
echo "Output written to $out/License.third-party.go.txt"
