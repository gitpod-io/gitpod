#!/bin/bash

# remove source maps
rm -rvf dist/*.map;

# ensure all files using Google Analytics have the proper format
# shellcheck disable=SC2044
for i in $(find public/ -name "*.html"); do
    if grep -q "Global site tag" "$i"; then
        if ! grep -q -- "-- gtag end --" "$i"; then
            echo "$i does not have a gtag end marker. This would break the remove-sources.sh script."
            echo 'Please add <!-- gtag end --> after the Google Analytics block'
            exit 1
        fi
    fi
done

# remove Google Analytics
echo "BEWARE: This script actually modifies files in the source tree"
rm public/google2db8c31aefd7ebbd.html
# shellcheck disable=SC2044
for i in $(find public/ -name "*.html"); do
    sed -i '/<!-- Global site tag/,/gtag end/d' "$i";
done
