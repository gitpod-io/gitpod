#!/bin/sh
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -ex

# shellcheck disable=SC2045
for i in $(ls /tests/*); do
    "$i" "$@";
done
