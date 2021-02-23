#!/bin/sh
set -ex

for i in $(ls /tests/*.test); do
    $i $*;
done
