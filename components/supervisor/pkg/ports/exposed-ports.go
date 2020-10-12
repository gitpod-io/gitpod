// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"context"

	"github.com/gitpod-io/gitpod/supervisor/pkg/gitpod"
)

// ExposedPort represents an exposed pprt
type ExposedPort struct {
	LocalPort  uint32
	GlobalPort uint32
	URL        string
	Public     bool
}

// ExposedPortsInterface provides access to port exposure
type ExposedPortsInterface interface {
	// Observe starts observing the exposed ports until the context is canceled.
	// The list of exposed ports is always the complete picture, i.e. if a single port changes,
	// the whole list is returned.
	// When the observer stops operating (because the context as canceled or an irrecoverable
	// error occured), the observer will close both channels.
	Observe(ctx context.Context) (<-chan []ExposedPort, <-chan error)

	// Expose exposes a port to the internet. Upon successful execution any Observer will be updated.
	Expose(ctx context.Context, local, global uint32, public bool) error
}

// NoopExposedPorts implements ExposedPortsInterface but does nothing
type NoopExposedPorts struct{}

// Observe starts observing the exposed ports until the context is canceled.
func (*NoopExposedPorts) Observe(ctx context.Context) (<-chan []ExposedPort, <-chan error) {
	return make(<-chan []ExposedPort), make(<-chan error)
}

// Expose exposes a port to the internet. Upon successful execution any Observer will be updated.
func (*NoopExposedPorts) Expose(ctx context.Context, local, global uint32, public bool) error {
	return nil
}

// GitpodExposedPorts uses a connection to the Gitpod server to implement
// the ExposedPortsInterface.
type GitpodExposedPorts struct {
	WorkspaceID string
	InstanceID  string
	C           gitpod.APIInterface
}

// Observe starts observing the exposed ports until the context is canceled.
func (g *GitpodExposedPorts) Observe(ctx context.Context) (<-chan []ExposedPort, <-chan error) {
	var (
		reschan = make(chan []ExposedPort)
		errchan = make(chan error, 1)
	)

	go func() {
		defer close(reschan)
		defer close(errchan)

		updates := g.C.InstanceUpdates(ctx, g.InstanceID)
		for {
			select {
			case u := <-updates:
				res := make([]ExposedPort, len(u.Status.ExposedPorts))
				for i, p := range u.Status.ExposedPorts {
					var localport = p.TargetPort
					if localport == 0 {
						// Ports exposed through confighuration (e.g. .gitpod.yml) do not have explicit target ports,
						// but rather implicitaly forward to their "port".
						localport = p.Port
					}

					res[i] = ExposedPort{
						GlobalPort: uint32(p.Port),
						LocalPort:  uint32(localport),
						Public:     p.Visibility == "public",
						URL:        p.URL,
					}
				}

				reschan <- res
			case <-ctx.Done():
				return
			}
		}
	}()

	return reschan, errchan
}

// Expose exposes a port to the internet. Upon successful execution any Observer will be updated.
func (g *GitpodExposedPorts) Expose(ctx context.Context, local, global uint32, public bool) error {
	var v string
	if public {
		v = "public"
	} else {
		v = "private"
	}
	_, err := g.C.OpenPort(ctx, g.WorkspaceID, &gitpod.WorkspaceInstancePort{
		Port:       float64(local),
		TargetPort: float64(global),
		Visibility: v,
	})
	if err != nil {
		return err
	}

	return nil
}
