#!/usr/bin/env bash

set -eu

if [[ "$(gcloud config get-value project)" != "{{ gcp.project }}" ]]; then
    gcloud auth activate-service-account --key-file="/tmp/service-account.json"
    gcloud config set project "{{ gcp.project }}"
    gcloud config set compute/region "{{ gcp.region }}"
    gcloud config set compute/zone "{{ gcp.zone }}"
fi
