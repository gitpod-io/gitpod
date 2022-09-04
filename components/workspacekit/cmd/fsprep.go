// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"os"

	"github.com/spf13/cobra"
	"golang.org/x/sys/unix"
)

var fsprepScript = `#!/bin/bash

set -x

log(){
	echo "$1"
}

fail(){
	log "$1"
	log "$1" 'oops. there is something wrong.'
	if ! /bin/sh ; then
		exit 1
		fi
}

log "starting overlay root..."
# this is the PVC disk  mounted in the POD using volumeDevice
disk=/dev/workspace

# check the disk contains a valid ext4 FS
if ! command -v blkid &>/dev/null; then
	echo "installing util-linux..."
	apt update
	apt install -y util-linux
fi

FS=$(blkid -o value -s TYPE "${disk}")
if [[ -z "${FS}" ]]; then
	mkfs.ext4 "${disk}"
fi

# create directories for the overlay and the fs shift
mkdir /mnt/lower
mkdir /mnt/overlay

# mount the disk
mount -t ext4 "${disk}" -o user_xattr,rw,errors=remount-ro /mnt/overlay
# prepare the overlay structure
mkdir /mnt/overlay/upper
mkdir /mnt/overlay/work
mkdir /mnt/newroot

mount -o "bind,ro" "/" /mnt/lower

mount -t overlay -o lowerdir=/mnt/lower,upperdir=/mnt/overlay/upper,workdir=/mnt/overlay/work overlayfs-root /mnt/newroot || \
	fail "ERROR: could not mount overlayFS"

log "remove root mount from fstab"
grep -v -x -E '^(#.*)|([[:space:]]*)$' /mnt/lower/etc/fstab | awk '$2 != "/" {print}' > /mnt/newroot/etc/fstab

log "change to the new overlay root"
cd /mnt/newroot
mkdir oldroot

mount --bind /proc /mnt/newroot/proc
mount --bind /etc/hosts /mnt/newroot/etc/hosts
mount --bind /etc/resolv.conf /mnt/newroot/etc/resolv.conf
mount --bind /etc/hostname /mnt/newroot/etc/hostname
mount --bind /dev/termination-log /mnt/newroot/dev/termination-log

# magic
pivot_root . oldroot

# more magic
cat | exec chroot . bash <<END
set -x

log(){
	echo "\$1"
}
fail(){
	log "\$1"
	log "there is something wrong with overlay-root"
	if ! /bin/sh ; then
		exit 1
	fi
}

mount --move /oldroot/sys /sys
mount --move /oldroot/dev /dev

log "unmount unneeded mounts so we can unmout the old readonly root"
cat /proc/mounts | grep /oldroot | cut -d ' ' -f 2 | sort -r | while read x; do umount -l \$x; done

# needed so that the IDE can produce the /workspace/.vscode-remote directory
mkdir -p /workspace
chown gitpod:gitpod /workspace

# create missing devices
mknod /dev/fuse -m 0666 c 10 229

mkdir -p /dev/net
mknod /dev/net/tun c 10 200
chmod 600 /dev/net/tun

touch /dev/kmsg


log "done. Running process..."
exec /.supervisor/supervisor init
END
`

var fsPrepCmd = &cobra.Command{
	Use:   "fsprep",
	Short: "does fs prep and call supervisor",
	RunE: func(_ *cobra.Command, args []string) error {
		err := os.WriteFile("/tmp/fsprep.sh", []byte(fsprepScript), 0755)
		if err != nil {
			return err
		}

		return unix.Exec("/tmp/fsprep.sh", []string{"/tmp/fsprep.sh"}, os.Environ())
	},
}

func init() {
	rootCmd.AddCommand(fsPrepCmd)
}
