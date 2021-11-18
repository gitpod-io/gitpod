#!/usr/bin/env bash
if [ -n "$VMLINUX_PATH" ]; then
    vmlinuz=$VMLINUX_PATH
else
    if [ -z "$WORKSPACE_KERNEL" ]; then
        echo "please export WORKSPACE_KERNEL"
        echo "e.g: export WORKSPACE_KERNEL=$(uname -r)"
        exit 1
    fi
    vmlinuz="/boot/vmlinuz-${WORKSPACE_KERNEL}"
fi

set -euo pipefail

script_dirname="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
outdir="${script_dirname}/_output"


rm -Rf ~/.ssh
sudo cp -r "${outdir}/.ssh" ~/.ssh
sudo chown -R "$(id -u):$(id -g)" ~/.ssh

sudo qemu-system-x86_64 -kernel "${vmlinuz}" \
-boot c -m 2049M -hda "${outdir}/bionic-server-cloudimg-amd64.img" \
-net user \
-smp 2 \
-append "root=/dev/sda rw console=ttyS0,115200 acpi=off nokaslr" \
-nic user,hostfwd=tcp::2222-:22 -s \
-serial mon:stdio -display none
