#!/bin/sh

if [ "A$GITHUB_TOKEN" = "A" ]; then
    printf '%s\n' "Please set the GITHUB_TOKEN env var to a personal access token. Otherwise this script won't work."
    exit 1
fi

cd $(dirname "$0")/..
out=$PWD

tmpdir=$(mktemp -d)
(cd $tmpdir; curl -L https://github.com/mitchellh/golicense/releases/download/v0.1.1/golicense_0.1.1_linux_x86_64.tar.gz | tar xzv)
golicense=$tmpdir/golicense

for i in $(ls components); do
    if [ -f "components/$i/go.mod" ]; then
        printf '%s\n' "building $i"
        cd components/$i
        go build -o exec

        printf '%s\n' "checking $i"
        timeout 60 $golicense -plain -license=true exec >> $out/licenses.$i.txt
        rm exec
        cd -
    fi
done

cat licenses.*.txt | sort | tr -s ' ' | uniq | sed -r 's/\s+/,/' | column -s , -t > $out/License.third-party.go.txt
printf '%s\n' "Output written to $out/License.third-party.go.txt"