#!/usr/bin/env bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

./setup.sh && ./run-tests.sh
returncode=$?

./teardown.sh

if [[ "$returncode" != "0" ]]; then
    echo "Tests failed"
else
    echo "Tests passed"
fi

exit $returncode
