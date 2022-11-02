#!/usr/bin/env bash

echo
echo "Finding the size of each package"
echo

# shellcheck disable=SC2012
ls -lh --sort=size /tmp/cache/*.tar.gz | while read -r line
do
    IFS=" " read -r -a info <<< "$line"
    IFS="/" read -r -a path <<< "${info[8]}"
    size=${info[4]}
    version=${path[3]//.tar.gz/}
    package=$(grep "$version" /tmp/collect.txt)
    if [[ -n "${package}" ]]; then
        printf "%s\t%s\n" "${size}" "${package}"
    fi
done
