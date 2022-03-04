// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"os"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestFindBindMountCandidates(t *testing.T) {
	tests := []struct {
		Name        string
		Mounts      string
		Readlink    func(path string) (dest string, err error)
		Expectation []string
	}{
		{
			Name:     "no configmap",
			Mounts:   "overlay / overlay rw,relatime,lowerdir=1714/fs:1713/fs:1712/fs:1711/fs:1710/fs:1709/fs:1708/fs:1707/fs:1706/fs:1705/fs:1704/fs:1703/fs:1702/fs:1701/fs:791/fs:257/fs:256/fs:255/fs:254/fs:253/fs:252/fs:251/fs:250/fs:249/fs:248/fs:247/fs:246/fs:245/fs:244/fs:243/fs:242/fs:241/fs:240/fs:239/fs:235/fs:234/fs:233/fs:232/fs:231/fs:230/fs:229/fs:228/fs:227/fs:226/fs:225/fs:224/fs:223/fs:222/fs:221/fs:220/fs:219/fs:215/fs,upperdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/1715/fs,workdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/1715/work,xino=off 0 0\nproc /proc proc rw,nosuid,nodev,noexec,relatime 0 0\ntmpfs /dev tmpfs rw,nosuid,size=65536k,mode=755 0 0\ndevpts /dev/pts devpts rw,nosuid,noexec,relatime,gid=5,mode=620,ptmxmode=666 0 0\nmqueue /dev/mqueue mqueue rw,nosuid,nodev,noexec,relatime 0 0\nsysfs /sys sysfs ro,nosuid,nodev,noexec,relatime 0 0\ntmpfs /sys/fs/cgroup tmpfs rw,nosuid,nodev,noexec,relatime,mode=755 0 0\ncgroup /sys/fs/cgroup/systemd cgroup ro,nosuid,nodev,noexec,relatime,xattr,name=systemd 0 0\ncgroup /sys/fs/cgroup/rdma cgroup ro,nosuid,nodev,noexec,relatime,rdma 0 0\ncgroup /sys/fs/cgroup/cpu,cpuacct cgroup ro,nosuid,nodev,noexec,relatime,cpu,cpuacct 0 0\ncgroup /sys/fs/cgroup/pids cgroup ro,nosuid,nodev,noexec,relatime,pids 0 0\ncgroup /sys/fs/cgroup/blkio cgroup ro,nosuid,nodev,noexec,relatime,blkio 0 0\ncgroup /sys/fs/cgroup/freezer cgroup ro,nosuid,nodev,noexec,relatime,freezer 0 0\ncgroup /sys/fs/cgroup/net_cls,net_prio cgroup ro,nosuid,nodev,noexec,relatime,net_cls,net_prio 0 0\ncgroup /sys/fs/cgroup/memory cgroup ro,nosuid,nodev,noexec,relatime,memory 0 0\ncgroup /sys/fs/cgroup/devices cgroup ro,nosuid,nodev,noexec,relatime,devices 0 0\ncgroup /sys/fs/cgroup/perf_event cgroup ro,nosuid,nodev,noexec,relatime,perf_event 0 0\ncgroup /sys/fs/cgroup/hugetlb cgroup ro,nosuid,nodev,noexec,relatime,hugetlb 0 0\ncgroup /sys/fs/cgroup/cpuset cgroup ro,nosuid,nodev,noexec,relatime,cpuset 0 0\n/dev/sdb /workspace ext4 rw,relatime,discard 0 0\n/dev/sdb /.workspace ext4 rw,relatime,discard 0 0\n/dev/sda1 /etc/hosts ext4 rw,relatime 0 0\n/dev/sda1 /dev/termination-log ext4 rw,relatime 0 0\n/dev/sda1 /etc/hostname ext4 rw,relatime 0 0\n/dev/sda1 /etc/resolv.conf ext4 rw,relatime 0 0\nshm /dev/shm tmpfs rw,nosuid,nodev,noexec,relatime,size=65536k 0 0\nproc /proc/bus proc ro,nosuid,nodev,noexec,relatime 0 0\nproc /proc/fs proc ro,nosuid,nodev,noexec,relatime 0 0\nproc /proc/irq proc ro,nosuid,nodev,noexec,relatime 0 0\nproc /proc/sys proc ro,nosuid,nodev,noexec,relatime 0 0\nproc /proc/sysrq-trigger proc ro,nosuid,nodev,noexec,relatime 0 0\ntmpfs /proc/acpi tmpfs ro,relatime 0 0\ntmpfs /proc/kcore tmpfs rw,nosuid,size=65536k,mode=755 0 0\ntmpfs /proc/keys tmpfs rw,nosuid,size=65536k,mode=755 0 0\ntmpfs /proc/timer_list tmpfs rw,nosuid,size=65536k,mode=755 0 0\ntmpfs /proc/sched_debug tmpfs rw,nosuid,size=65536k,mode=755 0 0\ntmpfs /proc/scsi tmpfs ro,relatime 0 0\ntmpfs /sys/firmware tmpfs ro,relatime 0 0",
			Readlink: func(path string) (dest string, err error) { return "", os.ErrNotExist },
			Expectation: []string{
				"/dev",
				"/sys",
				"/workspace",
				"/etc/hostname",
			},
		},
		{
			Name:     "without /workspace",
			Mounts:   "overlay / overlay rw,relatime,lowerdir=1714/fs:1713/fs:1712/fs:1711/fs:1710/fs:1709/fs:1708/fs:1707/fs:1706/fs:1705/fs:1704/fs:1703/fs:1702/fs:1701/fs:791/fs:257/fs:256/fs:255/fs:254/fs:253/fs:252/fs:251/fs:250/fs:249/fs:248/fs:247/fs:246/fs:245/fs:244/fs:243/fs:242/fs:241/fs:240/fs:239/fs:235/fs:234/fs:233/fs:232/fs:231/fs:230/fs:229/fs:228/fs:227/fs:226/fs:225/fs:224/fs:223/fs:222/fs:221/fs:220/fs:219/fs:215/fs,upperdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/1715/fs,workdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/1715/work,xino=off 0 0\nproc /proc proc rw,nosuid,nodev,noexec,relatime 0 0\ntmpfs /dev tmpfs rw,nosuid,size=65536k,mode=755 0 0\ndevpts /dev/pts devpts rw,nosuid,noexec,relatime,gid=5,mode=620,ptmxmode=666 0 0\nmqueue /dev/mqueue mqueue rw,nosuid,nodev,noexec,relatime 0 0\nsysfs /sys sysfs ro,nosuid,nodev,noexec,relatime 0 0\ntmpfs /sys/fs/cgroup tmpfs rw,nosuid,nodev,noexec,relatime,mode=755 0 0\ncgroup /sys/fs/cgroup/systemd cgroup ro,nosuid,nodev,noexec,relatime,xattr,name=systemd 0 0\ncgroup /sys/fs/cgroup/rdma cgroup ro,nosuid,nodev,noexec,relatime,rdma 0 0\ncgroup /sys/fs/cgroup/cpu,cpuacct cgroup ro,nosuid,nodev,noexec,relatime,cpu,cpuacct 0 0\ncgroup /sys/fs/cgroup/pids cgroup ro,nosuid,nodev,noexec,relatime,pids 0 0\ncgroup /sys/fs/cgroup/blkio cgroup ro,nosuid,nodev,noexec,relatime,blkio 0 0\ncgroup /sys/fs/cgroup/freezer cgroup ro,nosuid,nodev,noexec,relatime,freezer 0 0\ncgroup /sys/fs/cgroup/net_cls,net_prio cgroup ro,nosuid,nodev,noexec,relatime,net_cls,net_prio 0 0\ncgroup /sys/fs/cgroup/memory cgroup ro,nosuid,nodev,noexec,relatime,memory 0 0\ncgroup /sys/fs/cgroup/devices cgroup ro,nosuid,nodev,noexec,relatime,devices 0 0\ncgroup /sys/fs/cgroup/perf_event cgroup ro,nosuid,nodev,noexec,relatime,perf_event 0 0\ncgroup /sys/fs/cgroup/hugetlb cgroup ro,nosuid,nodev,noexec,relatime,hugetlb 0 0\ncgroup /sys/fs/cgroup/cpuset cgroup ro,nosuid,nodev,noexec,relatime,cpuset 0 0\n/dev/sdb /.workspace ext4 rw,relatime,discard 0 0\n/dev/sda1 /etc/hosts ext4 rw,relatime 0 0\n/dev/sda1 /dev/termination-log ext4 rw,relatime 0 0\n/dev/sda1 /etc/hostname ext4 rw,relatime 0 0\n/dev/sda1 /etc/resolv.conf ext4 rw,relatime 0 0\nshm /dev/shm tmpfs rw,nosuid,nodev,noexec,relatime,size=65536k 0 0\nproc /proc/bus proc ro,nosuid,nodev,noexec,relatime 0 0\nproc /proc/fs proc ro,nosuid,nodev,noexec,relatime 0 0\nproc /proc/irq proc ro,nosuid,nodev,noexec,relatime 0 0\nproc /proc/sys proc ro,nosuid,nodev,noexec,relatime 0 0\nproc /proc/sysrq-trigger proc ro,nosuid,nodev,noexec,relatime 0 0\ntmpfs /proc/acpi tmpfs ro,relatime 0 0\ntmpfs /proc/kcore tmpfs rw,nosuid,size=65536k,mode=755 0 0\ntmpfs /proc/keys tmpfs rw,nosuid,size=65536k,mode=755 0 0\ntmpfs /proc/timer_list tmpfs rw,nosuid,size=65536k,mode=755 0 0\ntmpfs /proc/sched_debug tmpfs rw,nosuid,size=65536k,mode=755 0 0\ntmpfs /proc/scsi tmpfs ro,relatime 0 0\ntmpfs /sys/firmware tmpfs ro,relatime 0 0",
			Readlink: func(path string) (dest string, err error) { return "", os.ErrNotExist },
			Expectation: []string{
				"/dev",
				"/sys",
				"/etc/hostname",
			},
		},
		{
			Name:   "with configmap",
			Mounts: "overlay / overlay rw,relatime,lowerdir=1714/fs:1713/fs:1712/fs:1711/fs:1710/fs:1709/fs:1708/fs:1707/fs:1706/fs:1705/fs:1704/fs:1703/fs:1702/fs:1701/fs:791/fs:257/fs:256/fs:255/fs:254/fs:253/fs:252/fs:251/fs:250/fs:249/fs:248/fs:247/fs:246/fs:245/fs:244/fs:243/fs:242/fs:241/fs:240/fs:239/fs:235/fs:234/fs:233/fs:232/fs:231/fs:230/fs:229/fs:228/fs:227/fs:226/fs:225/fs:224/fs:223/fs:222/fs:221/fs:220/fs:219/fs:215/fs,upperdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/1715/fs,workdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/1715/work,xino=off 0 0\nproc /proc proc rw,nosuid,nodev,noexec,relatime 0 0\ntmpfs /dev tmpfs rw,nosuid,size=65536k,mode=755 0 0\ndevpts /dev/pts devpts rw,nosuid,noexec,relatime,gid=5,mode=620,ptmxmode=666 0 0\nmqueue /dev/mqueue mqueue rw,nosuid,nodev,noexec,relatime 0 0\nsysfs /sys sysfs ro,nosuid,nodev,noexec,relatime 0 0\ntmpfs /sys/fs/cgroup tmpfs rw,nosuid,nodev,noexec,relatime,mode=755 0 0\ncgroup /sys/fs/cgroup/systemd cgroup ro,nosuid,nodev,noexec,relatime,xattr,name=systemd 0 0\ncgroup /sys/fs/cgroup/rdma cgroup ro,nosuid,nodev,noexec,relatime,rdma 0 0\ncgroup /sys/fs/cgroup/cpu,cpuacct cgroup ro,nosuid,nodev,noexec,relatime,cpu,cpuacct 0 0\ncgroup /sys/fs/cgroup/pids cgroup ro,nosuid,nodev,noexec,relatime,pids 0 0\ncgroup /sys/fs/cgroup/blkio cgroup ro,nosuid,nodev,noexec,relatime,blkio 0 0\ncgroup /sys/fs/cgroup/freezer cgroup ro,nosuid,nodev,noexec,relatime,freezer 0 0\ncgroup /sys/fs/cgroup/net_cls,net_prio cgroup ro,nosuid,nodev,noexec,relatime,net_cls,net_prio 0 0\ncgroup /sys/fs/cgroup/memory cgroup ro,nosuid,nodev,noexec,relatime,memory 0 0\ncgroup /sys/fs/cgroup/devices cgroup ro,nosuid,nodev,noexec,relatime,devices 0 0\ncgroup /sys/fs/cgroup/perf_event cgroup ro,nosuid,nodev,noexec,relatime,perf_event 0 0\ncgroup /sys/fs/cgroup/hugetlb cgroup ro,nosuid,nodev,noexec,relatime,hugetlb 0 0\ncgroup /sys/fs/cgroup/cpuset cgroup ro,nosuid,nodev,noexec,relatime,cpuset 0 0\n/dev/sdb /workspace ext4 rw,relatime,discard 0 0\n/dev/sdb /.workspace ext4 rw,relatime,discard 0 0\n/dev/sda1 /etc/hosts ext4 rw,relatime 0 0\n/dev/sda1 /dev/termination-log ext4 rw,relatime 0 0\n/dev/sda1 /etc/hostname ext4 rw,relatime 0 0\n/dev/sda1 /etc/resolv.conf ext4 rw,relatime 0 0\nshm /dev/shm tmpfs rw,nosuid,nodev,noexec,relatime,size=65536k 0 0\nproc /proc/bus proc ro,nosuid,nodev,noexec,relatime 0 0\nproc /proc/fs proc ro,nosuid,nodev,noexec,relatime 0 0\nproc /proc/irq proc ro,nosuid,nodev,noexec,relatime 0 0\nproc /proc/sys proc ro,nosuid,nodev,noexec,relatime 0 0\nproc /proc/sysrq-trigger proc ro,nosuid,nodev,noexec,relatime 0 0\ntmpfs /proc/acpi tmpfs ro,relatime 0 0\ntmpfs /proc/kcore tmpfs rw,nosuid,size=65536k,mode=755 0 0\ntmpfs /proc/keys tmpfs rw,nosuid,size=65536k,mode=755 0 0\ntmpfs /proc/timer_list tmpfs rw,nosuid,size=65536k,mode=755 0 0\ntmpfs /proc/sched_debug tmpfs rw,nosuid,size=65536k,mode=755 0 0\ntmpfs /proc/scsi tmpfs ro,relatime 0 0\ntmpfs /sys/firmware tmpfs ro,relatime 0 0\ntmpfs /custom-certs tmpfs ro,relatime 0 0",
			Readlink: func(path string) (dest string, err error) {
				if strings.HasPrefix(path, "/custom-certs") {
					return "..2021_07_22_14_41_17.266694288", nil
				}
				return "", os.ErrNotExist
			},
			Expectation: []string{
				"/dev",
				"/sys",
				"/workspace",
				"/etc/hostname",
				"/custom-certs",
			},
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act, err := findBindMountCandidates(bytes.NewReader([]byte(test.Mounts)), test.Readlink)
			if err != nil {
				t.Fatal(err)
			}
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected findBindMountCandidates() (-want +got):\n%s", diff)
			}
		})
	}
}
