#!/bin/bash
# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


# Syntax:
#    package-libs.sh BINARY
#
# BINARY can an executable or a shared object (.so) and should be in the ELF format.
#
# This script re-writes native dependencies: the ELF interpreter and shared libararies:
# It copies all dependencies to a folder ($DST) and registeres the copy via abosolute file name.
#
# Dependencies are processed recursively.
#
# This allows to have self-contained and thereby portable linux executables.

BINARY=$1
DST=/ide/node/lib/

echo "$BINARY: Starting rewiring libs to $DST"

[ -d "$DST" ] || mkdir -p "$DST"

INTERPRETER_ORIG=$(patchelf --print-interpreter $BINARY 2>/dev/null)
if [ ! -z "$INTERPRETER_ORIG" ]; then
    INTERPRETER_DST="${DST}$(basename $INTERPRETER_ORIG)"
    [ -f "${INTERPRETER_DST}" ] || cp "${INTERPRETER_ORIG}" "${INTERPRETER_DST}"
    patchelf --set-interpreter "${INTERPRETER_DST}" "${BINARY}"
    echo "${BINARY}: changed ELF interpreter from ${INTERPRETER_ORIG} to ${INTERPRETER_DST}"
fi

while IFS=$'\n' read -r LINE
do
    LIB_NAME=$(echo "$LINE" | cut -d '=' -f 1 | awk '{print $1}')
    LIB_ORIG=$(echo "$LINE" | cut -d '>' -f 2 | awk '{print $1}')
    if [ "${LIB_ORIG}" = "ldd" ]; then
        continue
    fi
    if [ -f "${LIB_ORIG}" ]; then 
        LIB_DST="${DST}$(basename $LIB_ORIG)"
        if [ ! -f $LIB_DST ]; then 
            cp "${LIB_ORIG}" "${LIB_DST}"
            "$0" "${LIB_DST}"
        fi
        patchelf --replace-needed "${LIB_NAME}" "${LIB_DST}" "${BINARY}"
        echo "${BINARY}: changed needed library from ${LIB_NAME} to ${LIB_DST}"
    else 
        echo "${BINARY}: library $LIB_ORIG not found."
    fi
done < <(ldd $BINARY 2>/dev/null)

echo "$BINARY: Finished rewiring libs to $DST"