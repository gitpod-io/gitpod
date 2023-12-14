// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package activation

import (
	"context"
	"net"
	"os"
	"sync"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/moredure/easygo/netpoll"
	"golang.org/x/xerrors"
)

// Callback is called when a listener is written to. Receivers are expected to close socketFD.
type Callback func(socketFD *os.File) error

// Listen polls on the listener and calls callback when someone writes to it.
func Listen(ctx context.Context, l net.Listener, activate Callback) error {
	poller, err := netpoll.New(&netpoll.Config{
		OnWaitError: func(err error) {
			log.WithError(err).Error("netpoll: wait loop error")
		},
	})
	if err != nil {
		return err
	}
	defer poller.Close()

	// Get netpoll descriptor with EventRead|EventEdgeTriggered.
	desc, err := netpoll.HandleListener(l, netpoll.EventRead|netpoll.EventEdgeTriggered)
	if err != nil {
		return err
	}
	defer desc.Close()

	var (
		runc = make(chan bool, 1)
		once sync.Once
	)

	err = poller.Start(desc, func(ev netpoll.Event) {
		defer once.Do(func() {
			_ = poller.Stop(desc)

			close(runc)
		})

		if ev&netpoll.EventReadHup != 0 {
			return
		}

		runc <- true
	})
	if err != nil {
		return err
	}

	select {
	case run := <-runc:
		if !run {
			return nil
		}
	case <-ctx.Done():
		return ctx.Err()
	}

	var f *os.File
	switch ll := l.(type) {
	case *net.UnixListener:
		f, err = ll.File()
	case *net.TCPListener:
		f, err = ll.File()
	default:
		return xerrors.Errorf("unsuported listener")
	}
	if err != nil {
		return err
	}
	return activate(f)
}
