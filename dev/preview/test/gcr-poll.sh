#!/usr/bin/env bash

# This is a primitive script to track the time at which we hit the GCR rate limit.

wget https://github.com/csweichel/oci-tool/releases/download/v0.2.0/oci-tool_0.2.0_linux_amd64.tar.gz
tar xzf oci-tool_0.2.0_linux_amd64.tar.gz

while true
do
    echo "Date: $(date)"
    ./oci-tool fetch manifest eu.gcr.io/gitpod-core-dev/build/versions:main.3191
    R=$?
    echo "Result: $R"
    sleep 10
done
