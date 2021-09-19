// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package tc

import (
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"

	"github.com/florianl/go-tc"
	"github.com/florianl/go-tc/core"
	"github.com/sirupsen/logrus"
)

func Load(file string, iface string, l *logrus.Logger) error {
	bpffile, err := os.Open(file)
	if err != nil {
		return fmt.Errorf("can't access file at %s", file)
	}
	defer bpffile.Close()

	bpffileFD := bpffile.Fd()
	l.WithField("path", file).WithField("fd", bpffileFD).Info("BPF ELF object")

	ifi, err := net.InterfaceByName(iface)
	if err != nil {
		return fmt.Errorf("could not get device: %v", err)
	}
	dev := uint32(ifi.Index)
	l.WithField("index", dev).Info("using iface")

	w := l.Writer()
	defer w.Close()
	logProxy := log.New(w, "", log.Lmsgprefix)

	// Open a rtnetlink socket
	rtnl, err := tc.Open(&tc.Config{
		Logger: logProxy, // proxy netlink messages to logrus
	})
	if err != nil {
		return fmt.Errorf("could not open rtnetlink socket: %v", err)
	}
	defer func() {
		if err := rtnl.Close(); err != nil {
			l.WithError(err).Error("could not close rtnetlink socket")
		} else {
			l.Info("exit: close rtnetlink socket")
		}
	}()

	l.Info("obtain rtnetlink socket")
	qdisc := rtnl.Qdisc()

	obj, err := addClsAct(qdisc, dev, iface, l)
	if err != nil {
		return fmt.Errorf("could not add qdisc: %v", err)
	}
	l.
		WithField("handle", fmthex(obj.Handle)).
		WithField("parent", fmthex(obj.Parent)).
		Infof("tc qdisc add dev %s clsact", iface) // qdisc clsact ffff:[ffff0000] dev eth0 parent ffff:fff1

	// fixme > should work but does not
	// // Add a filter
	// f := &tc.Object{
	// 	Msg: tc.Msg{
	// 		Ifindex: dev,
	// 		Handle:  0x1,
	// 		Parent:  0xFFFFFFF3, // core.BuildHandle(0xFFFF, tc.HandleMinEgress),
	// 		Info:    0xC0000300,
	// 	},
	// 	Attribute: tc.Attribute{
	// 		Kind: "bpf",
	// 		BPF: &tc.Bpf{
	// 			Name:     stringPtr("tcprova.bpf.o:[classifier]"),
	// 			FD:       uint32Ptr(uint32(bpffileFD)),
	// 			Flags:    uint32Ptr(uint32(tc.BpfActDirect)),
	// 			FlagsGen: uint32Ptr(uint32(tc.NotInHw | tc.Verbose)),
	// 		},
	// 	},
	// }
	// if err := rtnl.Filter().Add(f); err != nil {
	// 	return fmt.Errorf("could not add eBPF filter: %v", err)
	// }
	// l.Infof("tc filter add dev %s egress bpf ...", iface)

	c := exec.Command("tc", "filter", "add", "dev", iface, "egress", "bpf", "da", "obj", file, "section", "classifier", "verbose")
	stdout, err := c.Output()
	if err != nil {
		return fmt.Errorf("could not add eBPF filter: %v", err)
	}
	l.Infof("tc filter add dev %s egress bpf ...", iface)
	if len(stdout) > 0 {
		l.Info(string(stdout))
	}

	filters, err := rtnl.Filter().Get(&tc.Msg{
		Ifindex: dev,
		Handle:  0x1,
		Parent:  0xFFFFFFF3,
	})
	if err != nil {
		return fmt.Errorf("listng filters: %v", err)
	}

	for _, f := range filters {
		if f.BPF != nil {
			l.
				WithField("kind", "BPF").
				WithField("name", *f.Attribute.BPF.Name).
				WithField("id", *f.Attribute.BPF.ID).
				WithField("tag", fmt.Sprintf("%x", *f.Attribute.BPF.Tag)).
				Infof("tc filter show dev %s egress", iface)
		}
	}

	return nil
}

func addClsAct(qdisc *tc.Qdisc, dev uint32, iface string, l *logrus.Logger) (*tc.Object, error) {
	obj := &tc.Object{}
	obj.Attribute = tc.Attribute{
		Kind: "clsact",
	}
	obj.Msg = tc.Msg{
		Ifindex: dev,
		Handle:  core.BuildHandle(0xFFFF, 0x0000),
		Parent:  tc.HandleIngress,
	}

	if err := delClsAct(qdisc, obj); err != nil {
		return nil, err
	}
	l.
		WithField("handle", fmthex(obj.Handle)).
		WithField("parent", fmthex(obj.Parent)).
		Infof("tc qdisc del dev %s clsact", iface)

	if err := qdisc.Add(obj); err != nil {
		return nil, fmt.Errorf("could not assign clsact: %v", err)
	}

	return obj, nil
}

func delClsAct(qdisc *tc.Qdisc, obj *tc.Object) error {
	qdiscs, _ := qdisc.Get()
	for _, q := range qdiscs {
		if q.Ifindex == obj.Ifindex && q.Kind == obj.Kind {
			if err := qdisc.Delete(&q); err != nil {
				return fmt.Errorf("could not delete existing clsact: %v", err)
			}
		}
	}

	return nil
}

// func stringPtr(input string) *string {
// 	return &input
// }

// func uint32Ptr(input uint32) *uint32 {
// 	return &input
// }

func fmthex(input uint32) string {
	return fmt.Sprintf("0x%X", input)
}
