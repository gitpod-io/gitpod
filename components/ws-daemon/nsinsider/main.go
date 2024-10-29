// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"fmt"
	"io/ioutil"
	"net"
	"net/netip"
	"os"
	"time"
	"unsafe"

	cli "github.com/urfave/cli/v2"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	_ "github.com/gitpod-io/gitpod/common-go/nsenter"
	"github.com/google/nftables"
	"github.com/google/nftables/binaryutil"
	"github.com/google/nftables/expr"
	"github.com/vishvananda/netlink"
)

func main() {
	app := &cli.App{
		Commands: []*cli.Command{
			{
				Name:  "move-mount",
				Usage: "calls move_mount with the pipe-fd to target",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
					&cli.IntFlag{
						Name:     "pipe-fd",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					return syscallMoveMount(c.Int("pipe-fd"), "", unix.AT_FDCWD, c.String("target"), flagMoveMountFEmptyPath)
				},
			},
			{
				Name:  "open-tree",
				Usage: "opens a and writes the resulting mountfd to the Unix pipe on the pipe-fd",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
					&cli.IntFlag{
						Name:     "pipe-fd",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					fd, err := syscallOpenTree(unix.AT_FDCWD, c.String("target"), flagOpenTreeClone|flagAtRecursive)
					if err != nil {
						return err
					}

					err = unix.Sendmsg(c.Int("pipe-fd"), nil, unix.UnixRights(int(fd)), nil, 0)
					if err != nil {
						return err
					}

					return nil
				},
			},
			{
				Name:  "make-shared",
				Usage: "makes a mount point shared",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					return unix.Mount("none", c.String("target"), "", unix.MS_SHARED, "")
				},
			},
			{
				Name:  "mount-shiftfs-mark",
				Usage: "mounts a shiftfs mark",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "source",
						Required: true,
					},
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					return unix.Mount(c.String("source"), c.String("target"), "shiftfs", 0, "mark")
				},
			},
			{
				Name:  "mount-proc",
				Usage: "mounts proc",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					return unix.Mount("proc", c.String("target"), "proc", 0, "")
				},
			},
			{
				Name:  "mount-sysfs",
				Usage: "mounts sysfs",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					return unix.Mount("sysfs", c.String("target"), "sysfs", 0, "")
				},
			},
			{
				Name:  "unmount",
				Usage: "unmounts a mountpoint",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					return unix.Unmount(c.String("target"), 0)
				},
			},
			{
				Name:  "prepare-dev",
				Usage: "prepares a workspaces /dev directory",
				Flags: []cli.Flag{
					&cli.IntFlag{
						Name:     "uid",
						Required: true,
					},
					&cli.IntFlag{
						Name:     "gid",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					err := ioutil.WriteFile("/dev/kmsg", nil, 0644)
					if err != nil {
						return err
					}

					_ = os.MkdirAll("/dev/net", 0755)
					err = unix.Mknod("/dev/net/tun", 0666|unix.S_IFCHR, int(unix.Mkdev(10, 200)))
					if err != nil {
						return err
					}
					err = os.Chmod("/dev/net/tun", os.FileMode(0666))
					if err != nil {
						return err
					}
					err = os.Chown("/dev/net/tun", c.Int("uid"), c.Int("gid"))
					if err != nil {
						return err
					}

					if _, err := os.Stat("/dev/fuse"); os.IsNotExist(err) {
						err = unix.Mknod("/dev/fuse", 0666|unix.S_IFCHR, int(unix.Mkdev(10, 229)))
						if err != nil {
							return err
						}
					}

					err = os.Chmod("/dev/fuse", os.FileMode(0666))
					if err != nil {
						return err
					}
					err = os.Chown("/dev/fuse", c.Int("uid"), c.Int("gid"))
					if err != nil {
						return err
					}

					return nil
				},
			},
			{
				Name:  "setup-pair-veths",
				Usage: "set up a pair of veths",
				Flags: []cli.Flag{
					&cli.IntFlag{
						Name:     "target-pid",
						Required: true,
					},
					&cli.StringFlag{
						Name:     "workspace-cidr",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					containerIf, vethIf, cethIf := "eth0", "veth0", "eth0"
					networkCIDR := c.String("workspace-cidr")

					vethIp, cethIp, mask, err := processWorkspaceCIDR(networkCIDR)
					if err != nil {
						return xerrors.Errorf("parsing workspace CIDR (%v):%v", networkCIDR, err)
					}

					vethIpNet := net.IPNet{
						IP:   vethIp,
						Mask: mask.Mask,
					}

					targetPid := c.Int("target-pid")

					eth0, err := netlink.LinkByName(containerIf)
					if err != nil {
						return xerrors.Errorf("cannot get container network device %s: %w", containerIf, err)
					}

					veth := &netlink.Veth{
						LinkAttrs: netlink.LinkAttrs{
							Name:  vethIf,
							Flags: net.FlagUp,
							MTU:   eth0.Attrs().MTU,
						},
						PeerName:      cethIf,
						PeerNamespace: netlink.NsPid(targetPid),
					}
					if err := netlink.LinkAdd(veth); err != nil {
						return xerrors.Errorf("link %q-%q netns failed: %v", vethIf, cethIf, err)
					}

					vethLink, err := netlink.LinkByName(vethIf)
					if err != nil {
						return xerrors.Errorf("cannot found %q netns failed: %v", vethIf, err)
					}
					if err := netlink.AddrAdd(vethLink, &netlink.Addr{IPNet: &vethIpNet}); err != nil {
						return xerrors.Errorf("failed to add IP address to %q: %v", vethIf, err)
					}
					if err := netlink.LinkSetUp(vethLink); err != nil {
						return xerrors.Errorf("failed to enable %q: %v", vethIf, err)
					}

					nc := &nftables.Conn{}
					nat := nc.AddTable(&nftables.Table{
						Family: nftables.TableFamilyIPv4,
						Name:   "nat",
					})

					postrouting := nc.AddChain(&nftables.Chain{
						Name:     "postrouting",
						Hooknum:  nftables.ChainHookPostrouting,
						Priority: nftables.ChainPriorityNATSource,
						Table:    nat,
						Type:     nftables.ChainTypeNAT,
					})

					nc.AddRule(&nftables.Rule{
						Table: nat,
						Chain: postrouting,
						Exprs: []expr.Any{
							&expr.Meta{Key: expr.MetaKeyOIFNAME, Register: 1},
							&expr.Cmp{
								Op:       expr.CmpOpEq,
								Register: 1,
								Data:     []byte(fmt.Sprintf("%s\x00", containerIf)),
							},
							&expr.Masq{},
						},
					})

					prerouting := nc.AddChain(&nftables.Chain{
						Name:     "prerouting",
						Hooknum:  nftables.ChainHookPrerouting,
						Priority: nftables.ChainPriorityNATDest,
						Table:    nat,
						Type:     nftables.ChainTypeNAT,
					})

					// iif $containerIf tcp dport 1-65535 dnat to $cethIp:tcp dport
					nc.AddRule(&nftables.Rule{
						Table: nat,
						Chain: prerouting,
						Exprs: []expr.Any{
							&expr.Meta{Key: expr.MetaKeyIIFNAME, Register: 1},
							&expr.Cmp{
								Op:       expr.CmpOpEq,
								Register: 1,
								Data:     []byte(containerIf + "\x00"),
							},

							&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
							&expr.Cmp{
								Op:       expr.CmpOpEq,
								Register: 1,
								Data:     []byte{unix.IPPROTO_TCP},
							},
							&expr.Payload{
								DestRegister: 1,
								Base:         expr.PayloadBaseTransportHeader,
								Offset:       2,
								Len:          2,
							},

							&expr.Cmp{
								Op:       expr.CmpOpGte,
								Register: 1,
								Data:     []byte{0x00, 0x01},
							},
							&expr.Cmp{
								Op:       expr.CmpOpLte,
								Register: 1,
								Data:     []byte{0xff, 0xff},
							},

							&expr.Immediate{
								Register: 2,
								Data:     cethIp.To4(),
							},
							&expr.NAT{
								Type:        expr.NATTypeDestNAT,
								Family:      unix.NFPROTO_IPV4,
								RegAddrMin:  2,
								RegProtoMin: 1,
							},
						},
					})
					if err := nc.Flush(); err != nil {
						return xerrors.Errorf("failed to apply nftables: %v", err)
					}

					return nil
				},
			},
			{
				Name:  "setup-peer-veth",
				Usage: "set up a peer veth",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "workspace-cidr",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					cethIf := "eth0"

					networkCIDR := c.String("workspace-cidr")
					vethIp, cethIp, mask, err := processWorkspaceCIDR(networkCIDR)
					if err != nil {
						return xerrors.Errorf("parsing workspace CIDR (%v):%v", networkCIDR, err)
					}

					cethIpNet := net.IPNet{
						IP:   cethIp,
						Mask: mask.Mask,
					}

					cethLink, err := netlink.LinkByName(cethIf)
					if err != nil {
						return xerrors.Errorf("cannot found %q netns failed: %v", cethIf, err)
					}
					if err := netlink.AddrAdd(cethLink, &netlink.Addr{IPNet: &cethIpNet}); err != nil {
						return xerrors.Errorf("failed to add IP address to %q: %v", cethIf, err)
					}
					if err := netlink.LinkSetUp(cethLink); err != nil {
						return xerrors.Errorf("failed to enable %q: %v", cethIf, err)
					}

					lo, err := netlink.LinkByName("lo")
					if err != nil {
						return xerrors.Errorf("cannot found lo: %v", err)
					}
					if err := netlink.LinkSetUp(lo); err != nil {
						return xerrors.Errorf("failed to enable lo: %v", err)
					}

					defaultGw := netlink.Route{
						Scope: netlink.SCOPE_UNIVERSE,
						Gw:    vethIp,
					}
					if err := netlink.RouteReplace(&defaultGw); err != nil {
						return xerrors.Errorf("failed to set up default gw (%v): %v", vethIp.String(), err)
					}

					return nil
				},
			},
			{
				Name:  "enable-ip-forward",
				Usage: "enable IPv4 forwarding",
				Action: func(c *cli.Context) error {
					return os.WriteFile("/proc/sys/net/ipv4/ip_forward", []byte("1"), 0644)
				},
			},
			{
				Name:  "disable-ipv6",
				Usage: "disable IPv6",
				Action: func(c *cli.Context) error {
					return os.WriteFile("/proc/sys/net/ipv6/conf/all/disable_ipv6", []byte("1"), 0644)
				},
			},
			{
				Name:  "dump-network-info",
				Usage: "dump network info",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name: "tag",
					},
				},
				Action: func(c *cli.Context) error {
					links, err := netlink.LinkList()
					if err != nil {
						return xerrors.Errorf("cannot list network links: %v", err)
					}

					tag := c.String("tag")

					for _, link := range links {
						attrs := link.Attrs()

						ip4, _ := netlink.AddrList(link, netlink.FAMILY_V4)
						ip6, _ := netlink.AddrList(link, netlink.FAMILY_V6)

						log.Infof("%v", struct {
							Tag   string
							Name  string
							Type  string
							Ip4   []netlink.Addr
							Ip6   []netlink.Addr
							Flags net.Flags
							MTU   int
						}{
							Tag:   tag,
							Name:  attrs.Name,
							Type:  link.Type(),
							Ip4:   ip4,
							Ip6:   ip6,
							Flags: attrs.Flags,
							MTU:   attrs.MTU,
						})
					}

					return nil
				},
			},
			{
				Name:  "setup-connection-limit",
				Usage: "set up network connection rate limiting",
				Flags: []cli.Flag{
					&cli.IntFlag{
						Name:     "limit",
						Required: true,
					},
					&cli.IntFlag{
						Name:     "bucketsize",
						Required: false,
					},
					&cli.BoolFlag{
						Name:     "enforce",
						Required: false,
					},
				},
				Action: func(c *cli.Context) error {
					const drop_stats = "ws-connection-drop-stats"
					nftcon := nftables.Conn{}

					connLimit := c.Int("limit")
					bucketSize := c.Int("bucketsize")
					if bucketSize == 0 {
						bucketSize = 1000
					}
					enforce := c.Bool("enforce")

					// nft add table ip gitpod
					gitpodTable := nftcon.AddTable(&nftables.Table{
						Family: nftables.TableFamilyIPv4,
						Name:   "gitpod",
					})

					// nft add chain ip gitpod ratelimit { type filter hook postrouting priority 0 \; }
					ratelimit := nftcon.AddChain(&nftables.Chain{
						Table:    gitpodTable,
						Name:     "ratelimit",
						Type:     nftables.ChainTypeFilter,
						Hooknum:  nftables.ChainHookPostrouting,
						Priority: nftables.ChainPriorityFilter,
					})

					// nft add counter gitpod connection_drop_stats
					nftcon.AddObject(&nftables.CounterObj{
						Table: gitpodTable,
						Name:  drop_stats,
					})

					// nft add set gitpod ws-connections { type ipv4_addr; flags timeout, dynamic; }
					set := &nftables.Set{
						Table:      gitpodTable,
						Name:       "ws-connections",
						KeyType:    nftables.TypeIPAddr,
						Dynamic:    true,
						HasTimeout: true,
					}
					if err := nftcon.AddSet(set, nil); err != nil {
						return err
					}

					verdict := expr.VerdictAccept
					if enforce {
						verdict = expr.VerdictDrop
					}

					// nft add rule ip gitpod ratelimit ip protocol tcp ct state new meter ws-connections
					// '{ ip daddr & 0.0.0.0 timeout 1m limit rate over 3000/minute burst 1000 packets }' counter name ws-connection-drop-stats drop
					nftcon.AddRule(&nftables.Rule{
						// ip gitpod ratelimit
						Table: gitpodTable,
						Chain: ratelimit,

						Exprs: []expr.Any{
							// ip protocol tcp
							// get offset into network header and check if tcp
							&expr.Payload{
								DestRegister: 1,
								Base:         expr.PayloadBaseNetworkHeader,
								Offset:       uint32(9),
								Len:          uint32(1),
							},
							&expr.Cmp{
								Register: 1,
								Op:       expr.CmpOpEq,
								Data:     []byte{unix.IPPROTO_TCP},
							},
							// ct state new
							// get state from conntrack entry and check for 'new' (0x00000008)
							&expr.Ct{
								Key:            expr.CtKeySTATE,
								Register:       1,
								SourceRegister: false,
							},
							&expr.Bitwise{
								DestRegister:   1,
								SourceRegister: 1,
								Len:            4,
								Mask:           binaryutil.NativeEndian.PutUint32(expr.CtStateBitNEW),
								Xor:            binaryutil.NativeEndian.PutUint32(0),
							},
							&expr.Cmp{
								Register: 1,
								Op:       expr.CmpOpNeq,
								Data:     []byte{0, 0, 0, 0},
							},
							// ip daddr & 0.0.0.0
							// get the destination address and AND every address with zero
							// to ensure that every address is placed into the same bucket
							&expr.Payload{
								DestRegister: 1,
								Base:         expr.PayloadBaseNetworkHeader,
								Offset:       uint32(16),
								Len:          uint32(4),
							},
							&expr.Bitwise{
								DestRegister:   1,
								SourceRegister: 1,
								Len:            1,
								Mask:           []byte{0x00},
								Xor:            []byte{0x00},
							},
							// timeout 1m limit rate over 3000/minute burst 1000 packets
							&expr.Dynset{
								SrcRegKey: 1,
								SetName:   set.Name,
								Operation: uint32(unix.NFT_DYNSET_OP_ADD),
								Timeout:   time.Duration(60 * time.Second),
								Exprs: []expr.Any{
									&expr.Limit{
										Type:  expr.LimitTypePkts,
										Rate:  uint64(connLimit),
										Unit:  expr.LimitTimeMinute,
										Burst: uint32(bucketSize),
										Over:  true,
									},
								},
							},
							// counter name "ws-connection-drop-stats"
							&expr.Objref{
								Type: 1,
								Name: drop_stats,
							},
							// drop
							&expr.Verdict{
								Kind: verdict,
							},
						},
					})

					if err := nftcon.Flush(); err != nil {
						return xerrors.Errorf("failed to apply connection limit: %v", err)
					}

					return nil
				},
			},
		},
	}

	log.Init("nsinsider", "", true, false)
	err := app.Run(os.Args)
	if err != nil {
		log.WithField("instanceId", os.Getenv("GITPOD_INSTANCE_ID")).WithField("args", os.Args).Fatal(err)
	}
}

func syscallMoveMount(fromDirFD int, fromPath string, toDirFD int, toPath string, flags uintptr) error {
	fromPathP, err := unix.BytePtrFromString(fromPath)
	if err != nil {
		return err
	}
	toPathP, err := unix.BytePtrFromString(toPath)
	if err != nil {
		return err
	}

	_, _, errno := unix.Syscall6(unix.SYS_MOVE_MOUNT, uintptr(fromDirFD), uintptr(unsafe.Pointer(fromPathP)), uintptr(toDirFD), uintptr(unsafe.Pointer(toPathP)), flags, 0)
	if errno != 0 {
		return errno
	}

	return nil
}

const (
	// FlagMoveMountFEmptyPath: empty from path permitted: https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/mount.h#L70
	flagMoveMountFEmptyPath = 0x00000004
)

func syscallOpenTree(dfd int, path string, flags uintptr) (fd uintptr, err error) {
	p1, err := unix.BytePtrFromString(path)
	if err != nil {
		return 0, err
	}
	fd, _, errno := unix.Syscall(unix.SYS_OPEN_TREE, uintptr(dfd), uintptr(unsafe.Pointer(p1)), flags)
	if errno != 0 {
		return 0, errno
	}

	return fd, nil
}

const (
	// FlagOpenTreeClone: https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/mount.h#L62
	flagOpenTreeClone = 1
	// FlagAtRecursive: Apply to the entire subtree: https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/fcntl.h#L112
	flagAtRecursive = 0x8000
)

func processWorkspaceCIDR(networkCIDR string) (net.IP, net.IP, *net.IPNet, error) {
	netIP, mask, err := net.ParseCIDR(networkCIDR)
	if err != nil {
		return nil, nil, nil, xerrors.Errorf("cannot configure workspace CIDR: %w", err)
	}

	addr, err := netip.ParseAddr(netIP.String())
	if err != nil {
		return nil, nil, nil, xerrors.Errorf("cannot configure workspace CIDR: %w", err)
	}

	vethIp := addr.Next()
	if !vethIp.IsValid() {
		return nil, nil, nil, xerrors.Errorf("workspace CIDR is not big enough (%v)", networkCIDR)
	}

	cethIp := vethIp.Next()
	if !cethIp.IsValid() {
		return nil, nil, nil, xerrors.Errorf("workspace CIDR is not big enough (%v)", networkCIDR)
	}

	return net.ParseIP(vethIp.String()), net.ParseIP(cethIp.String()), mask, nil
}
