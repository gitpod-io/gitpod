package handover_test

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/registry-facade/pkg/handover"
	"golang.org/x/sync/errgroup"
)

func TestHandover(t *testing.T) {
	socketFN := filepath.Join(os.TempDir(), fmt.Sprintf("handover-test-%d.sock", time.Now().UnixNano()))

	l, err := net.Listen("tcp", ":44444")
	if err != nil {
		t.Fatalf("cannot start test listener: %q", err)
	}
	defer l.Close()
	tcpL := l.(*net.TCPListener)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	eg, ctx := errgroup.WithContext(ctx)
	eg.Go(func() error {
		return handover.OfferHandover(ctx, socketFN, tcpL)
	})
	eg.Go(func() error {
		// give the handover offer some time to start
		time.Sleep(1 * time.Millisecond)
		l, err := handover.ReceiveHandover(ctx, socketFN)
		if err != nil {
			return err
		}
		if l == nil {
			return fmt.Errorf("l was nil")
		}
		l.Close()
		return nil
	})
	err = eg.Wait()
	if err != nil {
		t.Fatal(err)
	}
}
