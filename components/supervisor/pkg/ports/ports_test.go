// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"io"
	"net"
	"sync"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/sirupsen/logrus"
	"golang.org/x/sync/errgroup"
)

func TestPortsUpdateState(t *testing.T) {
	type ExposureExpectation []ExposedPort
	type UpdateExpectation [][]*api.PortsStatus
	type ConfigChange struct {
		instance []*gitpod.PortsItems
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
	}{
		{
			Desc: "basic locally served",
			Changes: []Change{
				{Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 8080, true}}},
				{Exposed: []ExposedPort{{LocalPort: 8080, URL: "foobar"}}},
				{Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 8080, true}, {net.IPv4zero, 60000, false}}},
				{Served: []ServedPort{{net.IPv4zero, 60000, false}}},
				{Served: []ServedPort{}},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 8080},
				{LocalPort: 60000},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				[]*api.PortsStatus{{LocalPort: 8080, Served: true, OnOpen: api.PortsStatus_notify_private}},
				[]*api.PortsStatus{{LocalPort: 8080, Served: true, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{OnExposed: api.OnPortExposedAction_notify_private, Visibility: api.PortVisibility_private, Url: "foobar"}}},
				[]*api.PortsStatus{{LocalPort: 8080, Served: true, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{OnExposed: api.OnPortExposedAction_notify_private, Visibility: api.PortVisibility_private, Url: "foobar"}}, {LocalPort: 60000, Served: true}},
				[]*api.PortsStatus{{LocalPort: 8080, Served: false, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{OnExposed: api.OnPortExposedAction_notify_private, Visibility: api.PortVisibility_private, Url: "foobar"}}, {LocalPort: 60000, Served: true}},
				[]*api.PortsStatus{{LocalPort: 8080, Served: false, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{OnExposed: api.OnPortExposedAction_notify_private, Visibility: api.PortVisibility_private, Url: "foobar"}}},
			},
		},
		{
			Desc: "basic globally served",
			Changes: []Change{
				{Served: []ServedPort{{net.IPv4zero, 8080, false}}},
				{Served: []ServedPort{}},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 8080},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				[]*api.PortsStatus{{LocalPort: 8080, Served: true, OnOpen: api.PortsStatus_notify_private}},
				{},
			},
		},
		{
			Desc: "basic port publically exposed",
			Changes: []Change{
				{Served: []ServedPort{{Port: 8080}}},
				{Exposed: []ExposedPort{{LocalPort: 8080, Public: true, URL: "foobar"}}},
				{Exposed: []ExposedPort{{LocalPort: 8080, Public: false, URL: "foobar"}}},
			},
			ExpectedExposure: ExposureExpectation{
				{LocalPort: 8080},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				[]*api.PortsStatus{{LocalPort: 8080, Served: true, OnOpen: api.PortsStatus_notify_private}},
				[]*api.PortsStatus{{LocalPort: 8080, Served: true, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_public, Url: "foobar", OnExposed: api.OnPortExposedAction_notify_private}}},
				[]*api.PortsStatus{{LocalPort: 8080, Served: true, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, Url: "foobar", OnExposed: api.OnPortExposedAction_notify_private}}},
			},
		},
		{
			Desc:          "internal ports served",
			InternalPorts: []uint32{8080},
			Changes: []Change{
				{Served: []ServedPort{}},
				{Served: []ServedPort{{net.IPv4zero, 8080, false}}},
			},
			ExpectedExposure: ExposureExpectation(nil),
			ExpectedUpdates:  UpdateExpectation{{}},
		},
		{
			Desc: "serving port from the configured port range",
			Changes: []Change{
				{Config: &ConfigChange{
					instance: []*gitpod.PortsItems{{
						OnOpen: "open-browser",
						Port:   "4000-5000",
					}},
				}},
				{Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 4040, true}}},
				{Exposed: []ExposedPort{{LocalPort: 4040, Public: true, URL: "4040-foobar"}}},
				{Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 4040, true}, {net.IPv4zero, 60000, false}}},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 4040},
				{LocalPort: 60000},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{},
				[]*api.PortsStatus{{LocalPort: 4040, Served: true, OnOpen: api.PortsStatus_open_browser}},
				[]*api.PortsStatus{{LocalPort: 4040, Served: true, OnOpen: api.PortsStatus_open_browser, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_public, Url: "4040-foobar", OnExposed: api.OnPortExposedAction_open_browser}}},
				[]*api.PortsStatus{
					{LocalPort: 4040, Served: true, OnOpen: api.PortsStatus_open_browser, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_public, Url: "4040-foobar", OnExposed: api.OnPortExposedAction_open_browser}},
					{LocalPort: 60000, Served: true},
				},
			},
		},
		{
			Desc: "auto expose configured ports",
			Changes: []Change{
				{
					Config: &ConfigChange{instance: []*gitpod.PortsItems{
						{Port: 8080, Visibility: "private"},
					}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 8080, Public: false, URL: "foobar"}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 8080, Public: true, URL: "foobar"}},
				},
				{
					Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 8080, true}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 8080, Public: true, URL: "foobar"}},
				},
				{
					Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 8080, true}},
				},
				{
					Served: []ServedPort{},
				},
				{
					Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 8080, false}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 8080, Public: false},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				[]*api.PortsStatus{{LocalPort: 8080, OnOpen: api.PortsStatus_notify}},
				[]*api.PortsStatus{{LocalPort: 8080, OnOpen: api.PortsStatus_notify, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify, Url: "foobar"}}},
				[]*api.PortsStatus{{LocalPort: 8080, OnOpen: api.PortsStatus_notify, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_public, OnExposed: api.OnPortExposedAction_notify, Url: "foobar"}}},
				[]*api.PortsStatus{{LocalPort: 8080, Served: true, OnOpen: api.PortsStatus_notify, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_public, OnExposed: api.OnPortExposedAction_notify, Url: "foobar"}}},
				[]*api.PortsStatus{{LocalPort: 8080, OnOpen: api.PortsStatus_notify, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_public, OnExposed: api.OnPortExposedAction_notify, Url: "foobar"}}},
				[]*api.PortsStatus{{LocalPort: 8080, Served: true, OnOpen: api.PortsStatus_notify, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_public, OnExposed: api.OnPortExposedAction_notify, Url: "foobar"}}},
			},
		},
		{
			Desc: "starting multiple proxies for the same served event",
			Changes: []Change{
				{
					Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 8080, true}, {net.IPv4zero, 3000, true}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 8080},
				{LocalPort: 3000},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{
					{LocalPort: 3000, Served: true, OnOpen: api.PortsStatus_notify_private},
					{LocalPort: 8080, Served: true, OnOpen: api.PortsStatus_notify_private},
				},
			},
		},
		{
			Desc: "served between auto exposing configured and exposed update",
			Changes: []Change{
				{
					Config: &ConfigChange{instance: []*gitpod.PortsItems{
						{Port: 8080, Visibility: "private"},
					}},
				},
				{
					Served: []ServedPort{{net.IPv4zero, 8080, false}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 8080, Public: false, URL: "foobar"}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 8080},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{{LocalPort: 8080, OnOpen: api.PortsStatus_notify}},
				{{LocalPort: 8080, Served: true, OnOpen: api.PortsStatus_notify}},
				{{LocalPort: 8080, Served: true, OnOpen: api.PortsStatus_notify, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify, Url: "foobar"}}},
			},
		},
		{
			Desc: "the same port served locally and then globally too, prefer globally (exposed in between)",
			Changes: []Change{
				{
					Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 5900, true}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 5900, URL: "foobar"}},
				},
				{
					Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 5900, true}, {net.IPv4zero, 5900, false}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 5900, URL: "foobar"}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 5900},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private}},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify_private, Url: "foobar"}}},
			},
		},
		{
			Desc: "the same port served locally and then globally too, prefer globally (exposed after)",
			Changes: []Change{
				{
					Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 5900, true}},
				},
				{
					Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 5900, true}, {net.IPv4zero, 5900, false}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 5900, URL: "foobar"}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 5900, URL: "foobar"}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 5900},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private}},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify_private, Url: "foobar"}}},
			},
		},
		{
			Desc: "the same port served globally and then locally too, prefer globally (exposed in between)",
			Changes: []Change{
				{
					Served: []ServedPort{{net.IPv4zero, 5900, false}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 5900, URL: "foobar"}},
				},
				{
					Served: []ServedPort{{net.IPv4zero, 5900, false}, {net.IPv4(127, 0, 0, 1), 5900, true}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 5900},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private}},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify_private, Url: "foobar"}}},
			},
		},
		{
			Desc: "the same port served globally and then locally too, prefer globally (exposed after)",
			Changes: []Change{
				{
					Served: []ServedPort{{net.IPv4zero, 5900, false}},
				},
				{
					Served: []ServedPort{{net.IPv4zero, 5900, false}, {net.IPv4(127, 0, 0, 1), 5900, true}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 5900, URL: "foobar"}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 5900},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private}},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify_private, Url: "foobar"}}},
			},
		},
		{
			Desc: "the same port served locally on ip4 and then locally on ip6 too, prefer first (exposed in between)",
			Changes: []Change{
				{
					Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 5900, true}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 5900, URL: "foobar"}},
				},
				{
					Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 5900, true}, {net.IPv6zero, 5900, true}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 5900},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private}},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify_private, Url: "foobar"}}},
			},
		},
		{
			Desc: "the same port served locally on ip4 and then locally on ip6 too, prefer first (exposed after)",
			Changes: []Change{
				{
					Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 5900, true}},
				},
				{
					Served: []ServedPort{{net.IPv4(127, 0, 0, 1), 5900, true}, {net.IPv6zero, 5900, true}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 5900, URL: "foobar"}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 5900},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private}},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify_private, Url: "foobar"}}},
			},
		},
		{
			Desc: "the same port served locally on ip4 and then globally on ip6 too, prefer first (exposed in between)",
			Changes: []Change{
				{
					Served: []ServedPort{{net.IPv4zero, 5900, false}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 5900, URL: "foobar"}},
				},
				{
					Served: []ServedPort{{net.IPv4zero, 5900, false}, {net.IPv6zero, 5900, false}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 5900},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private}},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify_private, Url: "foobar"}}},
			},
		},
		{
			Desc: "the same port served locally on ip4 and then globally on ip6 too, prefer first (exposed after)",
			Changes: []Change{
				{
					Served: []ServedPort{{net.IPv4zero, 5900, false}},
				},
				{
					Served: []ServedPort{{net.IPv4zero, 5900, false}, {net.IPv6zero, 5900, false}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 5900, URL: "foobar"}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 5900},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private}},
				{{LocalPort: 5900, Served: true, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify_private, Url: "foobar"}}},
			},
		},
		{
			Desc: "port status has description set as soon as the port gets exposed, if there was a description configured",
			Changes: []Change{
				{
					Config: &ConfigChange{instance: []*gitpod.PortsItems{
						{Port: 8080, Visibility: "private", Description: "Development server"},
					}},
				},
				{
					Served: []ServedPort{{net.IPv4zero, 8080, false}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 8080, Public: false, URL: "foobar"}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 8080},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{{LocalPort: 8080, Description: "Development server", OnOpen: api.PortsStatus_notify}},
				{{LocalPort: 8080, Description: "Development server", Served: true, OnOpen: api.PortsStatus_notify}},
				{{LocalPort: 8080, Description: "Development server", Served: true, OnOpen: api.PortsStatus_notify, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify, Url: "foobar"}}},
			},
		},
		{
			Desc: "port status has the name attribute set as soon as the port gets exposed, if there was a name configured in Gitpod's Workspace",
			Changes: []Change{
				{
					Config: &ConfigChange{instance: []*gitpod.PortsItems{
						{Port: 3000, Visibility: "private", Name: "react"},
					}},
				},
				{
					Served: []ServedPort{{net.IPv4zero, 3000, false}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 3000, Public: false, URL: "foobar"}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 3000},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{{LocalPort: 3000, Name: "react", OnOpen: api.PortsStatus_notify}},
				{{LocalPort: 3000, Name: "react", Served: true, OnOpen: api.PortsStatus_notify}},
				{{LocalPort: 3000, Name: "react", Served: true, OnOpen: api.PortsStatus_notify, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify, Url: "foobar"}}},
			},
		},
		{
			Desc: "change configed ports order",
			Changes: []Change{
				{
					Config: &ConfigChange{instance: []*gitpod.PortsItems{
						{Port: 3001, Visibility: "private", Name: "react"},
						{Port: 3000, Visibility: "private", Name: "react"},
					}},
				},
				{
					Config: &ConfigChange{instance: []*gitpod.PortsItems{
						{Port: "5000-5999", Visibility: "private", Name: "react"},
						{Port: 3001, Visibility: "private", Name: "react"},
						{Port: 3000, Visibility: "private", Name: "react"},
					}},
				},
				{
					Served: []ServedPort{{net.IPv4zero, 5002, false}},
				},
				{
					Served: []ServedPort{{net.IPv4zero, 5002, false}, {net.IPv4zero, 5001, false}},
				},
				{
					Config: &ConfigChange{instance: []*gitpod.PortsItems{
						{Port: 3000, Visibility: "private", Name: "react"},
						{Port: 3001, Visibility: "private", Name: "react"},
					}},
				},
				{
					Served: []ServedPort{{net.IPv4zero, 5001, false}, {net.IPv4zero, 3000, false}},
				},
				{
					Exposed: []ExposedPort{{LocalPort: 3000, Public: false, URL: "foobar"}},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 5002},
				{LocalPort: 5001},
				{LocalPort: 3000},
				{LocalPort: 3001},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{
					{LocalPort: 3001, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3000, Name: "react", OnOpen: api.PortsStatus_notify},
				},
				{
					{LocalPort: 3001, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3000, Name: "react", OnOpen: api.PortsStatus_notify},
				},
				{
					{LocalPort: 5002, Name: "react", Served: true, OnOpen: api.PortsStatus_notify},
					{LocalPort: 3001, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3000, Name: "react", OnOpen: api.PortsStatus_notify},
				},
				{
					{LocalPort: 5001, Name: "react", Served: true, OnOpen: api.PortsStatus_notify},
					{LocalPort: 5002, Name: "react", Served: true, OnOpen: api.PortsStatus_notify},
					{LocalPort: 3001, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3000, Name: "react", OnOpen: api.PortsStatus_notify},
				},
				{
					{LocalPort: 3000, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3001, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 5001, Served: true, OnOpen: api.PortsStatus_notify_private},
					{LocalPort: 5002, Served: true, OnOpen: api.PortsStatus_notify_private},
				},
				{
					{LocalPort: 3000, Name: "react", Served: true, OnOpen: api.PortsStatus_notify},
					{LocalPort: 3001, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 5001, Served: true, OnOpen: api.PortsStatus_notify_private},
				},
				{
					{LocalPort: 3000, Name: "react", Served: true, OnOpen: api.PortsStatus_notify, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify, Url: "foobar"}},
					{LocalPort: 3001, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 5001, Served: true, OnOpen: api.PortsStatus_notify_private},
				},
			},
		},
		{
			Desc: "change configed ports order with ranged covered not ranged",
			Changes: []Change{
				{
					Config: &ConfigChange{
						instance: []*gitpod.PortsItems{
							{Port: 3001, Visibility: "private", Name: "react"},
							{Port: 3000, Visibility: "private", Name: "react"},
						},
					},
				},
				{
					Config: &ConfigChange{
						instance: []*gitpod.PortsItems{
							{Port: 3003, Visibility: "private", Name: "react"},
							{Port: 3001, Visibility: "private", Name: "react"},
							{Port: "3001-3005", Visibility: "private", Name: "react"},
							{Port: 3000, Visibility: "private", Name: "react"},
						},
					},
				},
				{
					Served: []ServedPort{{net.IPv4zero, 3000, false}},
				},
				{
					Served: []ServedPort{{net.IPv4zero, 3000, false}, {net.IPv4zero, 3001, false}, {net.IPv4zero, 3002, false}},
				},
				{
					Config: &ConfigChange{
						instance: []*gitpod.PortsItems{
							{Port: 3003, Visibility: "private", Name: "react"},
							{Port: 3000, Visibility: "private", Name: "react"},
						},
					},
				},
				{
					Config: &ConfigChange{
						instance: []*gitpod.PortsItems{
							{Port: "3001-3005", Visibility: "private", Name: "react"},
							{Port: 3003, Visibility: "private", Name: "react"},
							{Port: 3000, Visibility: "private", Name: "react"},
						},
					},
				},
			},
			ExpectedExposure: []ExposedPort{
				{LocalPort: 3000},
				{LocalPort: 3001},
				{LocalPort: 3002},
				{LocalPort: 3003},
			},
			ExpectedUpdates: UpdateExpectation{
				{},
				{
					{LocalPort: 3001, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3000, Name: "react", OnOpen: api.PortsStatus_notify},
				},
				{
					{LocalPort: 3003, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3001, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3000, Name: "react", OnOpen: api.PortsStatus_notify},
				},
				{
					{LocalPort: 3003, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3001, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3000, Served: true, Name: "react", OnOpen: api.PortsStatus_notify},
				},
				{
					{LocalPort: 3003, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3001, Served: true, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3002, Served: true, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3000, Served: true, Name: "react", OnOpen: api.PortsStatus_notify},
				},
				{
					{LocalPort: 3003, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3000, Served: true, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3001, Served: true, OnOpen: api.PortsStatus_notify_private},
					{LocalPort: 3002, Served: true, OnOpen: api.PortsStatus_notify_private},
				},
				{
					{LocalPort: 3001, Name: "react", Served: true, OnOpen: api.PortsStatus_notify},
					{LocalPort: 3002, Name: "react", Served: true, OnOpen: api.PortsStatus_notify},
					{LocalPort: 3003, Name: "react", OnOpen: api.PortsStatus_notify},
					{LocalPort: 3000, Served: true, Name: "react", OnOpen: api.PortsStatus_notify},
				},
			},
		},
		{
			// Please make sure this test pass for code browser resolveExternalPort
			// see also https://github.com/gitpod-io/openvscode-server/blob/5ab7644a8bbf37d28e23212bc6f1529cafd8bf7b/extensions/gitpod-web/src/extension.ts#L310-L339
			Desc: "expose port without served, port should be responded for use case of openvscode-server",
			Changes: []Change{
				{
					Exposed: []ExposedPort{{LocalPort: 3000, Public: false, URL: "foobar"}},
				},
			},
			// this will not exposed because test manager didn't implement it properly
			// ExpectedExposure: []ExposedPort{
			// 	{LocalPort: 3000},
			// },
			ExpectedUpdates: UpdateExpectation{
				{},
				{
					{LocalPort: 3000, OnOpen: api.PortsStatus_notify_private, Exposed: &api.ExposedPortInfo{Visibility: api.PortVisibility_private, OnExposed: api.OnPortExposedAction_notify_private, Url: "foobar"}},
				},
			},
		},
	}

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
				sortExposed      = cmpopts.SortSlices(func(x, y ExposedPort) bool { return x.LocalPort < y.LocalPort })
				ignoreUnexported = cmpopts.IgnoreUnexported(
					api.PortsStatus{},
					api.ExposedPortInfo{},
				)
			)
			if diff := cmp.Diff(test.ExpectedExposure, ExposureExpectation(exposed.Exposures), sortExposed, ignoreUnexported); diff != "" {
				t.Errorf("unexpected exposures (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(test.ExpectedUpdates, UpdateExpectation(updts), ignoreUnexported); diff != "" {
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

func (tep *testExposedPorts) Expose(ctx context.Context, local uint32, public bool, protocol string) <-chan error {
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

func TestManager_getStatus(t *testing.T) {
	type portState struct {
		port      uint32
		notServed bool
	}
	type fields struct {
		orderInYaml []any
		state       []portState
	}
	tests := []struct {
		name   string
		fields fields
		want   []uint32
	}{
		{
			name: "happy path",
			fields: fields{
				// The port number (e.g. 1337) or range (e.g. 3000-3999) to expose.
				orderInYaml: []any{1002, 1000, "3000-3999", 1001},
				state:       []portState{{port: 1000}, {port: 1001}, {port: 1002}, {port: 3003}, {port: 3001}, {port: 3002}, {port: 4002}, {port: 4000}, {port: 5000}, {port: 5005}},
			},
			want: []uint32{1002, 1000, 3001, 3002, 3003, 1001, 4000, 4002, 5000, 5005},
		},
		{
			name: "order for ranged ports and inside ranged order by number ASC",
			fields: fields{
				orderInYaml: []any{1002, "3000-3999", 1009, "4000-4999"},
				state:       []portState{{port: 5000}, {port: 1000}, {port: 1009}, {port: 4000}, {port: 4001}, {port: 3000}, {port: 3009}},
			},
			want: []uint32{3000, 3009, 1009, 4000, 4001, 1000, 5000},
		},
		{
			name: "served ports order by number ASC",
			fields: fields{
				orderInYaml: []any{},
				state:       []portState{{port: 4000}, {port: 4003}, {port: 4007}, {port: 4001}, {port: 4006}},
			},
			want: []uint32{4000, 4001, 4003, 4006, 4007},
		},
		{
			// Please make sure this test pass for code browser resolveExternalPort
			// see also https://github.com/gitpod-io/openvscode-server/blob/5ab7644a8bbf37d28e23212bc6f1529cafd8bf7b/extensions/gitpod-web/src/extension.ts#L310-L339
			name: "expose not served ports should respond their status",
			fields: fields{
				orderInYaml: []any{},
				state:       []portState{{port: 4000, notServed: true}},
			},
			want: []uint32{4000},
		},
		// It will not works because we do not `Run` ports Manger
		// As ports Manger will autoExpose those ports (but not ranged port) in yaml
		// and they will exists in state
		// {
		// 	name: "not ignore ports that not served but exists in yaml",
		// 	fields: fields{
		// 		orderInYaml: []any{1002, 1000, 1001},
		// 		state:       []uint32{},
		// 	},
		// 	want: []uint32{1002, 1000, 1001},
		// },
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			state := make(map[uint32]*managedPort)
			for _, s := range tt.fields.state {
				state[s.port] = &managedPort{
					Served:             !s.notServed,
					LocalhostPort:      s.port,
					TunneledTargetPort: s.port,
					TunneledClients:    map[string]uint32{},
				}
			}
			portsItems := []*gitpod.PortsItems{}
			for _, port := range tt.fields.orderInYaml {
				portsItems = append(portsItems, &gitpod.PortsItems{Port: port})
			}
			portsConfig, rangeConfig := parseInstanceConfigs(portsItems)
			pm := &Manager{
				configs: &Configs{
					instancePortConfigs:  portsConfig,
					instanceRangeConfigs: rangeConfig,
				},
				state: state,
			}
			got := pm.getStatus()
			if len(got) != len(tt.want) {
				t.Errorf("Manager.getStatus() length = %v, want %v", len(got), len(tt.want))
			}
			gotPorts := []uint32{}
			for _, g := range got {
				gotPorts = append(gotPorts, g.LocalPort)
			}
			if diff := cmp.Diff(gotPorts, tt.want); diff != "" {
				t.Errorf("unexpected exposures (-want +got):\n%s", diff)
			}
		})
	}
}
