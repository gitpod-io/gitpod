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

rm -Rf "$outdir"
mkdir -p "$outdir"

curl -L -o "${outdir}/rootfs.tar.gz" $img_url

cd "$outdir"

tar -xvf rootfs.tar.gz

qemu-img resize bionic-server-cloudimg-amd64.img +20G

sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'resize2fs /dev/sda'

sudo virt-customize -a bionic-server-cloudimg-amd64.img --root-password password:root

# copy kernel modules
sudo virt-customize -a bionic-server-cloudimg-amd64.img --copy-in /lib/modules/"$WORKSPACE_KERNEL":/lib/modules

sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'echo "[Network]\nDHCP=ipv4" > /etc/systemd/network/20-dhcp.network'

sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'apt update && apt remove openssh-server -y && apt install openssh-server -y'

# code binary
sudo virt-customize -a bionic-server-cloudimg-amd64.img --copy-in "${script_dirname}/code":/usr/bin

# workspace mount under /workspace
sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'apt install sshfs -y'
sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'ssh-keygen -b 2048 -t rsa -f /root/.ssh/id_rsa -q -N ""'
sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'mkdir /workspace'
sudo virt-copy-out -a bionic-server-cloudimg-amd64.img /root/.ssh/id_rsa.pub /tmp

mkdir -p .ssh
chmod 700 .ssh
cat /tmp/id_rsa.pub >> .ssh/authorized_keys
chmod 600 .ssh/authorized_keys

rm -f .ssh/id_rsa_vm
ssh-keygen -b 2048 -t rsa -f .ssh/id_rsa_vm -q -N ""

rm -f .ssh/config
cp "${script_dirname}/config" .ssh/config

sudo virt-customize -a bionic-server-cloudimg-amd64.img --copy-in .ssh/id_rsa_vm.pub:/tmp
sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'cat /tmp/id_rsa_vm.pub >> /root/.ssh/authorized_keys'
sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'chmod 600 /root/.ssh/authorized_keys'

sudo virt-customize -a bionic-server-cloudimg-amd64.img --copy-in "${script_dirname}/workspace.mount":/lib/systemd/system
sudo virt-customize -a bionic-server-cloudimg-amd64.img --copy-in "${script_dirname}/workspace.automount":/lib/systemd/system
sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'systemctl enable workspace.automount'

echo "BPF environment is ready"
