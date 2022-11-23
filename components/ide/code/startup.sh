#!/bin/sh
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
export USER=gitpod

cd /ide || exit
exec /ide/codehelper "$@"
