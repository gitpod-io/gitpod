#!/usr/bin/env bash

set -euo pipefail

if [ ! "$WORKSPACE_KERNEL" == "$(uname -r)" ]; then
    echo "The WORKSPACE_KERNEL environment variable and the current running workspace kernel are not equal, please update the WORKSPACE_KERNEL variable accordingly in the workspace dockerfile: dev/image/Dockerfile"
    echo "WORKPACE_KERNEL=${WORKSPACE_KERNEL}"
    echo "Current kernel=$(uname -r)"
    exit 1
fi

img_url="https://cloud-images.ubuntu.com/bionic/current/bionic-server-cloudimg-amd64.tar.gz"

script_dirname="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
outdir="${script_dirname}/_output"

rm -Rf $outdir
mkdir -p $outdir

curl -L -o "${outdir}/rootfs.tar.gz" $img_url

cd $outdir

tar -xvf rootfs.tar.gz

qemu-img resize bionic-server-cloudimg-amd64.img +20G

sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'resize2fs /dev/sda'

sudo virt-customize -a bionic-server-cloudimg-amd64.img --root-password password:root

# copy kernel modules
sudo virt-customize -a bionic-server-cloudimg-amd64.img --copy-in /lib/modules/$WORKSPACE_KERNEL:/lib/modules

sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'echo "[Network]\nDHCP=ipv4" > /etc/systemd/network/20-dhcp.network'

sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'apt remove openssh-server -y && apt install openssh-server -y'
sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command "sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config"
sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command "sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config"


echo "BPF environment is ready"
