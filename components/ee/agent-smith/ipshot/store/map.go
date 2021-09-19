// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package store

import (
	"encoding/binary"
	"net"
	"strconv"
	"strings"

	"github.com/cilium/ebpf"
	log "github.com/sirupsen/logrus"
)

func Attach(path string, cleanup bool) (*ebpf.Map, error) {
	mmm, err := ebpf.LoadPinnedMap(path, nil)
	if err != nil {
		return nil, err
	}

	if cleanup {
		var k uint32
		err = mmm.NextKey(nil, &k)
		for err == nil {
			log.WithField("key", k).Debug("cleaning")
			mmm.Delete(k)
			err = mmm.NextKey(k, &k)
		}
	}

	return mmm, nil
}

func UpsertV4(mmm *ebpf.Map, ips []net.IP, val uint16) (int, error) {
	// Slice of uint16 containing the index of the domain the IP refer to
	vals := make([]uint16, len(ips))
	for j := range vals {
		vals[j] = val
	}
	// IPv4 to uint32
	keys := make([]uint32, len(ips))
	for k := range keys {
		keys[k] = ipv4ToUint32(ips[k])
	}
	return mmm.BatchUpdate(keys, vals, nil)
}

func DeleteV4(mmm *ebpf.Map, ips []net.IP) (int, error) {
	// IPv4 to uint32
	keys := make([]uint32, len(ips))
	for k := range keys {
		keys[k] = ipv4ToUint32(ips[k])
	}
	return mmm.BatchDelete(keys, nil)
}

func UpsertV6(mmm *ebpf.Map, ips []net.IP, val uint16) (int, error) {
	// todo > implement
	// todo > use []bytes to store every IPv6 address?
	return 0, nil
}

func ipv4ToUint32(ip net.IP) uint32 {
	if ip.IsUnspecified() {
		return 0
	}
	if len(ip) == 16 {
		return binary.BigEndian.Uint32(ipv4ton(ip[12:16]))
	}
	return binary.BigEndian.Uint32(ipv4ton(ip))
}

func ipv4ton(ip net.IP) []byte {
	x := ip.To4()
	ox := strings.Split(x.String(), ".")

	o0, _ := strconv.Atoi(ox[0])
	o1, _ := strconv.Atoi(ox[1])
	o2, _ := strconv.Atoi(ox[2])
	o3, _ := strconv.Atoi(ox[3])

	return []byte{byte(o3), byte(o2), byte(o1), byte(o0)}
}

// func ipv6ToInt(IPv6Addr net.IP) *big.Int {
//     IPv6Int := big.NewInt(0)
//     IPv6Int.SetBytes(IPv6Addr)
//     return IPv6Int
// }
