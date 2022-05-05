// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"io"
	"net"
	"sync"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/sirupsen/logrus"
	"golang.org/x/sync/errgroup"

	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

func TestPortsUpdateState(t *testing.T) {
	type ExposureExpectation []ExposedPort
	type UpdateExpectation [][]*api.PortsStatus
	type ConfigChange struct {
		workspace []*gitpod.PortConfig
		instance  []*gitpod.PortsItems
	}
	type Change struct {
		Config      *ConfigChange
		Served      []ServedPort
		Exposed     []ExposedPort
		Tunneled    []PortTunnelState
		ConfigErr   error
		ServedErr   error
		ExposedErr  error
		TunneledErr error
	}
	tests := []struct {
		Desc             string
		InternalPorts    []uint32
		Changes          []Change
		ExpectedExposure ExposureExpectation
		ExpectedUpdates  UpdateExpectation
	}{}

	log.Log.Logger.SetLevel(logrus.FatalLevel)

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			var (
				exposed = &testExposedPorts{
					Changes: make(chan []ExposedPort),
					Error:   make(chan error, 1),
				}
				served = &testServedPorts{
					Changes: make(chan []ServedPort),
					Error:   make(chan error, 1),
				}
				config = &testConfigService{
					Changes: make(chan *Configs),
					Error:   make(chan error, 1),
				}
				tunneled = &testTunneledPorts{
					Changes: make(chan []PortTunnelState),
					Error:   make(chan error, 1),
				}

				pm    = NewManager(exposed, served, config, tunneled, test.InternalPorts...)
				updts [][]*api.PortsStatus
			)
			pm.proxyStarter = func(port uint32) (io.Closer, error) {
				return io.NopCloser(nil), nil
			}

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			var wg sync.WaitGroup
			wg.Add(3)
			go pm.Run(ctx, &wg)
			sub, err := pm.Subscribe()
			if err != nil {
				t.Fatal(err)
			}
			go func() {
				defer wg.Done()
				defer sub.Close()

				for up := range sub.Updates() {
					updts = append(updts, up)
				}
			}()
			go func() {
				defer wg.Done()
				defer close(config.Error)
				defer close(config.Changes)
				defer close(served.Error)
				defer close(served.Changes)
				defer close(exposed.Error)
				defer close(exposed.Changes)
				defer close(tunneled.Error)
				defer close(tunneled.Changes)

				for _, c := range test.Changes {
					if c.Config != nil {
						change := &Configs{}
						change.workspaceConfigs = parseWorkspaceConfigs(c.Config.workspace)
						portConfigs, rangeConfigs := parseInstanceConfigs(c.Config.instance)
						change.instancePortConfigs = portConfigs
						change.instanceRangeConfigs = rangeConfigs
						config.Changes <- change
					} else if c.ConfigErr != nil {
						config.Error <- c.ConfigErr
					} else if c.Served != nil {
						served.Changes <- c.Served
					} else if c.ServedErr != nil {
						served.Error <- c.ServedErr
					} else if c.Exposed != nil {
						exposed.Changes <- c.Exposed
					} else if c.ExposedErr != nil {
						exposed.Error <- c.ExposedErr
					} else if c.Tunneled != nil {
						tunneled.Changes <- c.Tunneled
					} else if c.TunneledErr != nil {
						tunneled.Error <- c.TunneledErr
					}
				}
			}()

			wg.Wait()

			var (
				sorPorts         = cmpopts.SortSlices(func(x, y uint32) bool { return x < y })
				sortPortStatus   = cmpopts.SortSlices(func(x, y *api.PortsStatus) bool { return x.LocalPort < y.LocalPort })
				sortExposed      = cmpopts.SortSlices(func(x, y ExposedPort) bool { return x.LocalPort < y.LocalPort })
				ignoreUnexported = cmpopts.IgnoreUnexported(
					api.PortsStatus{},
					api.ExposedPortInfo{},
				)
			)
			if diff := cmp.Diff(test.ExpectedExposure, ExposureExpectation(exposed.Exposures), sortExposed, ignoreUnexported); diff != "" {
				t.Errorf("unexpected exposures (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(test.ExpectedUpdates, UpdateExpectation(updts), sorPorts, sortPortStatus, ignoreUnexported); diff != "" {
				t.Errorf("unexpected updates (-want +got):\n%s", diff)
			}
		})
	}
}

type testTunneledPorts struct {
	Changes chan []PortTunnelState
	Error   chan error
}

func (tep *testTunneledPorts) Observe(ctx context.Context) (<-chan []PortTunnelState, <-chan error) {
	return tep.Changes, tep.Error
}
func (tep *testTunneledPorts) Tunnel(ctx context.Context, options *TunnelOptions, descs ...*PortTunnelDescription) ([]uint32, error) {
	return nil, nil
}
func (tep *testTunneledPorts) CloseTunnel(ctx context.Context, localPorts ...uint32) ([]uint32, error) {
	return nil, nil
}
func (tep *testTunneledPorts) EstablishTunnel(ctx context.Context, clientID string, localPort uint32, targetPort uint32) (net.Conn, error) {
	return nil, nil
}

type testConfigService struct {
	Changes chan *Configs
	Error   chan error
}

func (tep *testConfigService) Observe(ctx context.Context) (<-chan *Configs, <-chan error) {
	return tep.Changes, tep.Error
}

type testExposedPorts struct {
	Changes chan []ExposedPort
	Error   chan error

	Exposures []ExposedPort
	mu        sync.Mutex
}

func (tep *testExposedPorts) Observe(ctx context.Context) (<-chan []ExposedPort, <-chan error) {
	return tep.Changes, tep.Error
}

func (tep *testExposedPorts) Run(ctx context.Context) {
}

func (tep *testExposedPorts) Expose(ctx context.Context, local uint32, public bool) <-chan error {
	tep.mu.Lock()
	defer tep.mu.Unlock()

	tep.Exposures = append(tep.Exposures, ExposedPort{
		LocalPort: local,
		Public:    public,
	})
	return nil
}

type testServedPorts struct {
	Changes chan []ServedPort
	Error   chan error
}

func (tps *testServedPorts) Observe(ctx context.Context) (<-chan []ServedPort, <-chan error) {
	return tps.Changes, tps.Error
}

// testing for deadlocks between subscribing and processing events
func TestPortsConcurrentSubscribe(t *testing.T) {
	var (
		subscribes  = 100
		subscribing = make(chan struct{})
		exposed     = &testExposedPorts{
			Changes: make(chan []ExposedPort),
			Error:   make(chan error, 1),
		}
		served = &testServedPorts{
			Changes: make(chan []ServedPort),
			Error:   make(chan error, 1),
		}
		config = &testConfigService{
			Changes: make(chan *Configs),
			Error:   make(chan error, 1),
		}
		tunneled = &testTunneledPorts{
			Changes: make(chan []PortTunnelState),
			Error:   make(chan error, 1),
		}
		pm = NewManager(exposed, served, config, tunneled)
	)
	pm.proxyStarter = func(local uint32) (io.Closer, error) {
		return io.NopCloser(nil), nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var wg sync.WaitGroup
	wg.Add(2)
	go pm.Run(ctx, &wg)
	go func() {
		defer wg.Done()
		defer close(config.Error)
		defer close(config.Changes)
		defer close(served.Error)
		defer close(served.Changes)
		defer close(exposed.Error)
		defer close(exposed.Changes)
		defer close(tunneled.Error)
		defer close(tunneled.Changes)

		var j uint32
		for {

			select {
			case <-time.After(50 * time.Millisecond):
				served.Changes <- []ServedPort{{Port: j}}
				j++
			case <-subscribing:
				return
			}
		}
	}()

	eg, _ := errgroup.WithContext(context.Background())
	for i := 0; i < maxSubscriptions; i++ {
		eg.Go(func() error {
			for j := 0; j < subscribes; j++ {
				sub, err := pm.Subscribe()
				if err != nil {
					return err
				}
				// status
				select {
				case <-sub.Updates():
				// update
				case <-sub.Updates():
				}
				sub.Close()
			}
			return nil
		})
	}
	err := eg.Wait()
	close(subscribing)
	if err != nil {
		t.Fatal(err)
	}

	wg.Wait()
}
