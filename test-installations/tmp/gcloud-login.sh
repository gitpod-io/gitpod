#!/usr/bin/env bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


set -eu

#PROJECT=clu-self-hosted-playground
PROJECT=gitpod-self-hosted-testing

if [[ "$(gcloud config get-value project)" != "$PROJECT" ]]; then
    gcloud auth activate-service-account --key-file="./service-account.json"
    gcloud config set project "$PROJECT"
    gcloud config set compute/region "europe-west3"
    gcloud config set compute/zone "europe-west3-a"
fi
