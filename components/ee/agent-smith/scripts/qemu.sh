#!/usr/bin/env bash

set -euo pipefail

vmlinuz="vmlinuz-${WORKSPACE_KERNEL}"

script_dirname="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
outdir="${script_dirname}/_output"

rm -Rf ~/.ssh
cp -r "${outdir}/.ssh" ~/.ssh

sudo qemu-system-x86_64 -kernel "/boot/${vmlinuz}" \
-boot c -m 2049M -hda "${outdir}/bionic-server-cloudimg-amd64.img" \
-net user \
-smp 2 \
-append "root=/dev/sda rw console=ttyS0,115200 acpi=off nokaslr" \
-nic user,hostfwd=tcp::2222-:22 \
-serial mon:stdio -display none
