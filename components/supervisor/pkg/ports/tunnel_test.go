// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/google/go-cmp/cmp"
	"golang.org/x/sync/errgroup"

	"github.com/gitpod-io/gitpod/supervisor/api"
)

// TODO(ak) add reverse test.
func TestLocalPortTunneling(t *testing.T) {
	updates := make(chan []PortTunnelState, 4)
	assertUpdate := func(expectation []PortTunnelState) {
		update := <-updates
		if diff := cmp.Diff(expectation, update); diff != "" {
			t.Errorf("unexpected exposures (-want +got):\n%s", diff)
		}
	}

	doneCtx, done := context.WithCancel(context.Background())
	eg, ctx := errgroup.WithContext(context.Background())
	service := NewTunneledPortsService(false)
	tunneled, errors := service.Observe(ctx)
	eg.Go(func() error {
		for {
			select {
			case <-doneCtx.Done():
				return nil
			case ports := <-tunneled:
				if ports == nil {
					close(updates)
					return nil
				}
				updates <- ports
			case err := <-errors:
				return err
			}
		}
	})
	assertUpdate([]PortTunnelState{})

	localPort, err := availablePort()
	if err != nil {
		t.Fatal(err)
	}
	localListener, err := net.Listen("tcp", "127.0.0.1:"+strconv.FormatInt(int64(localPort), 10))
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("local service is listening on %d\n", localPort)
	eg.Go(func() error {
		go func() {
			<-doneCtx.Done()
			localListener.Close()
		}()
		localServer := http.Server{
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				b, _ := ioutil.ReadAll(r.Body)
				_, _ = w.Write(append(b, '!'))
			}),
		}
		_ = localServer.Serve(localListener)
		return nil
	})

	targetPort, err := availablePort()
	if err != nil {
		t.Fatal(err)
	}
	desc := PortTunnelDescription{
		LocalPort:  localPort,
		TargetPort: targetPort,
		Visibility: api.TunnelVisiblity_host,
	}
	_, err = service.Tunnel(ctx, &TunnelOptions{
		SkipIfExists: false,
	}, &PortTunnelDescription{
		LocalPort:  localPort,
		TargetPort: targetPort,
		Visibility: api.TunnelVisiblity_host,
	})
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("%d:%d tunnel has been created\n", localPort, targetPort)
	assertUpdate([]PortTunnelState{{Desc: desc, Clients: map[string]uint32{}}})

	targetAddr := "127.0.0.1:" + strconv.FormatInt(int64(targetPort), 10)
	proxyAddr, err := net.ResolveTCPAddr("tcp", targetAddr)
	if err != nil {
		t.Fatal(err)
	}
	proxyListener, err := net.ListenTCP("tcp", proxyAddr)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("target proxy is listening on %d\n", targetPort)
	eg.Go(func() error {
		defer proxyListener.Close()

		src, err := proxyListener.Accept()
		if err != nil {
			return err
		}
		defer src.Close()

		dst, err := service.EstablishTunnel(ctx, "test", localPort, targetPort)
		if err != nil {
			return err
		}
		defer dst.Close()

		done := make(chan struct{})
		var once sync.Once
		go func() {
			_, _ = io.Copy(src, dst)
			once.Do(func() { close(done) })
		}()
		go func() {
			_, _ = io.Copy(dst, src)
			once.Do(func() { close(done) })
		}()
		<-done
		return nil
	})

	// actually open ssh channel
	resp, err := http.Post("http://"+targetAddr, "text/plain", strings.NewReader("Hello World"))
	if err != nil {
		t.Fatal(err)
	}
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != ("Hello World!") {
		t.Fatal("wrong resp")
	}
	assertUpdate([]PortTunnelState{{Desc: desc, Clients: map[string]uint32{"test": targetPort}}})

	_, err = service.CloseTunnel(ctx, localPort)
	if err != nil {
		t.Fatal(err)
	}
	assertUpdate([]PortTunnelState{})

	done()

	err = eg.Wait()
	if err != nil && err != context.Canceled {
		t.Error(err)
	}
}

func availablePort() (uint32, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	l.Close()
	_, parsed, err := net.SplitHostPort(l.Addr().String())
	if err != nil {
		return 0, err
	}
	port, err := strconv.Atoi(parsed)
	if err != nil {
		return 0, err
	}
	return uint32(port), nil
}
