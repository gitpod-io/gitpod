#!/usr/bin/env bash

set -euo pipefail

vmlinux_url="http://security.ubuntu.com/ubuntu/pool/main/l/linux-signed-gke-5.4/linux-image-5.4.0-1033-gke_5.4.0-1033.35~18.04.1_amd64.deb"
modules_url="http://security.ubuntu.com/ubuntu/pool/main/l/linux-gke-5.4/linux-modules-5.4.0-1033-gke_5.4.0-1033.35~18.04.1_amd64.deb"
img_url="https://cloud-images.ubuntu.com/bionic/current/bionic-server-cloudimg-amd64.tar.gz"

script_dirname="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
outdir="${script_dirname}/_output"

rm -Rf $outdir
mkdir -p $outdir

curl -L -o "${outdir}/linux-image.deb" $vmlinux_url
curl -L -o "${outdir}/linux-modules.deb" $modules_url
curl -L -o "${outdir}/rootfs.tar.gz" $img_url

cd $outdir

tar -xvf rootfs.tar.gz

qemu-img resize bionic-server-cloudimg-amd64.img +20G

sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'resize2fs /dev/sda'

sudo virt-customize -a bionic-server-cloudimg-amd64.img --root-password password:root
sudo virt-customize -a bionic-server-cloudimg-amd64.img --copy-in linux-modules.deb:/root

sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'dpkg -i /root/linux-modules.deb'

sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'echo "[Network]\nDHCP=ipv4" > /etc/systemd/network/20-dhcp.network'

sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command 'apt remove openssh-server -y && apt install openssh-server -y'
sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command "sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config"
sudo virt-customize -a bionic-server-cloudimg-amd64.img --run-command "sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config"
ar x linux-image.deb
tar -xvf data.tar.xz

echo "BPF environment is ready"
