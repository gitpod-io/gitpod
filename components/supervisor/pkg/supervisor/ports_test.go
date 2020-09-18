// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"io"
	"io/ioutil"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestPortsUpdateState(t *testing.T) {
	type Expectation [][]managedPort
	tests := []struct {
		Desc          string
		Changes       [][]netPort
		Expected      Expectation
		InternalPorts []uint32
	}{
		{
			Desc: "basic locally bound",
			Changes: [][]netPort{
				{{8080, true}},
				{},
			},
			Expected: Expectation{
				[]managedPort{
					{GlobalPort: 60000, LocalhostPort: 8080, Proxied: true},
					{GlobalPort: 60000, LocalhostPort: 8080, Proxied: false, Proxy: ioutil.NopCloser(nil)},
				},
				[]managedPort{},
			},
		},
		{
			Desc: "basic globally bound",
			Changes: [][]netPort{
				{{8080, false}},
				{},
			},
			Expected: Expectation{
				[]managedPort{
					{GlobalPort: 8080, LocalhostPort: 8080},
				},
				[]managedPort{},
			},
		},
		{
			Desc:          "internal ports",
			InternalPorts: []uint32{8080},
			Changes: [][]netPort{
				{},
				{{8080, false}},
			},
			Expected: Expectation{
				[]managedPort{{Internal: true}},
				[]managedPort{{Internal: true}},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			var (
				pm  = newPortsManager(test.InternalPorts...)
				act = make(Expectation, 0, len(test.Changes))
			)
			pm.proxyStarter = func(dst *managedPort, openPorts map[uint32]struct{}) (err error) {
				dst.GlobalPort = 60000
				dst.Proxy = ioutil.NopCloser(nil)
				return nil
			}

			for _, chng := range test.Changes {
				pm.updateState(chng)

				tact := make([]managedPort, 0, len(pm.state))
				for _, mp := range pm.state {
					tact = append(tact, managedPort{
						Internal:      mp.Internal,
						GlobalPort:    mp.GlobalPort,
						LocalhostPort: mp.LocalhostPort,
						Proxied:       mp.Proxied,
						Proxy:         mp.Proxy,
					})
				}
				sort.Slice(tact, func(i, j int) bool {
					if tact[i].LocalhostPort == tact[j].LocalhostPort {
						return tact[i].Proxied
					}
					return tact[i].LocalhostPort < tact[j].LocalhostPort
				})
				act = append(act, tact)
			}

			cmpopts := []cmp.Option{
				cmp.Comparer(func(a, b io.Closer) bool {
					return (a == nil && b == nil) || (a != nil && b != nil)
				}),
			}
			if diff := cmp.Diff(test.Expected, act, cmpopts...); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}
