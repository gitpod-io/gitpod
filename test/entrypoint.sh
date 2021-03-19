#!/bin/sh
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -ex

for i in $(ls /tests/*.test); do
    $i $*;
done
