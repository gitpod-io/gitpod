// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"io"
	"io/ioutil"
	"sort"
	"sync"
	"testing"

	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/google/go-cmp/cmp"
)

func TestPortsUpdateState(t *testing.T) {
	type StateExpectation [][]managedPort
	type ExposureExpectation []ExposedPort
	type UpdateExpectation [][]*api.PortsStatus
	type Change struct {
		Served     []ServedPort
		Exposed    []ExposedPort
		ServedErr  error
		ExposedErr error
	}
	tests := []struct {
		Desc             string
		InternalPorts    []uint32
		Changes          []Change
		ExpectedState    StateExpectation
		ExpectedExposure ExposureExpectation
		ExpectedUpdates  UpdateExpectation
	}{
		{
			Desc: "basic locally served",
			Changes: []Change{
				{Served: []ServedPort{{8080, true}}},
				{Served: []ServedPort{}},
			},
			ExpectedState: StateExpectation{
				[]managedPort{
					{Served: false, GlobalPort: 60000, LocalhostPort: 8080, IsOurProxy: true},
					{Served: true, GlobalPort: 60000, LocalhostPort: 8080, IsOurProxy: false, Proxy: ioutil.NopCloser(nil)},
				},
				[]managedPort{},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 8080, GlobalPort: 60000},
			},
			ExpectedUpdates: UpdateExpectation{
				{{LocalPort: 8080, GlobalPort: 60000, Served: true}},
				{},
			},
		},
		{
			Desc: "basic globally served",
			Changes: []Change{
				{Served: []ServedPort{{8080, false}}},
				{Served: []ServedPort{}},
			},
			ExpectedState: StateExpectation{
				[]managedPort{{Served: true, GlobalPort: 8080, LocalhostPort: 8080}},
				[]managedPort{},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 8080, GlobalPort: 8080},
			},
			ExpectedUpdates: UpdateExpectation{
				{{LocalPort: 8080, GlobalPort: 8080, Served: true}},
				{},
			},
		},
		{
			Desc: "basic port publically exposed",
			Changes: []Change{
				{Exposed: []ExposedPort{{LocalPort: 8080, GlobalPort: 8080, Public: false, URL: "foobar"}}},
				{Exposed: []ExposedPort{{LocalPort: 8080, GlobalPort: 8080, Public: true, URL: "foobar"}}},
				{Served: []ServedPort{{Port: 8080}}},
			},
			ExpectedState: StateExpectation{
				[]managedPort{{Exposed: true, GlobalPort: 8080, LocalhostPort: 8080, Public: false, URL: "foobar"}},
				[]managedPort{{Exposed: true, GlobalPort: 8080, LocalhostPort: 8080, Public: true, URL: "foobar"}},
				[]managedPort{{Exposed: true, GlobalPort: 8080, LocalhostPort: 8080, Public: true, URL: "foobar", Served: true}},
			},
			ExpectedUpdates: UpdateExpectation{
				{{LocalPort: 8080, GlobalPort: 8080, Exposed: &api.PortsStatus_ExposedPortInfo{Public: false, Url: "foobar"}}},
				{{LocalPort: 8080, GlobalPort: 8080, Exposed: &api.PortsStatus_ExposedPortInfo{Public: true, Url: "foobar"}}},
				{{LocalPort: 8080, GlobalPort: 8080, Served: true, Exposed: &api.PortsStatus_ExposedPortInfo{Public: true, Url: "foobar"}}},
			},
		},
		{
			Desc:          "internal ports served",
			InternalPorts: []uint32{8080},
			Changes: []Change{
				{Served: []ServedPort{}},
				{Served: []ServedPort{{8080, false}}},
			},

			// serving internal ports does not cause any state change
			ExpectedState:    StateExpectation{},
			ExpectedExposure: ExposureExpectation(nil),
			ExpectedUpdates:  UpdateExpectation(nil),
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			var (
				exposed = &testExposedPorts{
					Changes: make(chan []ExposedPort),
					Error:   make(chan error),
				}
				served = &testServedPorts{
					Changes: make(chan []ServedPort),
					Error:   make(chan error),
				}
				cfgprov = &FixedPortConfigProvider{}
				pm      = NewManager(exposed, served, cfgprov, test.InternalPorts...)
				act     = make(StateExpectation, 0, len(test.Changes))
				updts   [][]*api.PortsStatus
			)
			pm.proxyStarter = func(dst *managedPort, openPorts map[uint32]struct{}) (err error) {
				dst.GlobalPort = 60000
				dst.Proxy = ioutil.NopCloser(nil)
				return nil
			}
			pm.testingStatusChanged = func() {
				tact := make([]managedPort, 0, len(pm.state))
				for _, mp := range pm.state {
					tact = append(tact, *mp)
				}
				sort.Slice(tact, func(i, j int) bool {
					if tact[i].LocalhostPort == tact[j].LocalhostPort {
						return tact[i].IsOurProxy
					}
					return tact[i].LocalhostPort < tact[j].LocalhostPort
				})
				act = append(act, tact)
			}

			var wg sync.WaitGroup
			wg.Add(3)
			go func() {
				defer wg.Done()
				pm.Run()
			}()
			go func() {
				defer wg.Done()
				defer close(served.Error)
				defer close(served.Changes)
				defer close(exposed.Error)
				defer close(exposed.Changes)

				for _, c := range test.Changes {
					if c.Served != nil {
						served.Changes <- c.Served
					} else if c.ServedErr != nil {
						served.Error <- c.ServedErr
					} else if c.Exposed != nil {
						exposed.Changes <- c.Exposed
					} else if c.ExposedErr != nil {
						exposed.Error <- c.ExposedErr
					}
				}
			}()
			go func() {
				defer wg.Done()

				sub := pm.Subscribe()
				defer sub.Close()

				// BUG(cw): looks like subscriptions don't always get closed properly when the port manager stops.
				//          This is why the tests fail at times.

				for up := range sub.Updates() {
					updts = append(updts, up)
				}
			}()

			wg.Wait()
			cmpopts := []cmp.Option{
				cmp.Comparer(func(a, b io.Closer) bool {
					return (a == nil && b == nil) || (a != nil && b != nil)
				}),
			}
			if diff := cmp.Diff(test.ExpectedState, act, cmpopts...); diff != "" {
				t.Errorf("unexpected state (-want +got):\n%s", diff)
			}
			if diff := cmp.Diff(test.ExpectedExposure, ExposureExpectation(exposed.Exposures)); diff != "" {
				t.Errorf("unexpected exposures (-want +got):\n%s", diff)
			}
			if diff := cmp.Diff(test.ExpectedUpdates, UpdateExpectation(updts)); diff != "" {
				t.Errorf("unexpected updates (-want +got):\n%s", diff)
			}
		})
	}
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

func (tep *testExposedPorts) Expose(ctx context.Context, local, global uint32, public bool) error {
	tep.mu.Lock()
	defer tep.mu.Unlock()

	tep.Exposures = append(tep.Exposures, ExposedPort{
		GlobalPort: global,
		LocalPort:  local,
		Public:     public,
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
