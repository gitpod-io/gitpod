#!/bin/bash

mkdir -p bin

for i in $(find . -type d -name "*_agent"); do
    echo building agent $i
    base=$(basename $i)
    CGO_ENABLED=0 go build -o bin/gitpod-integration-test-${base%_agent}-agent $i
done

for i in $(ls tests/); do
    echo building test $i
    CGO_ENABLED=0 go test -c ./tests/$i
    mv $i.test bin
done