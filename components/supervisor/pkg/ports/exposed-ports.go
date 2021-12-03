// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"golang.org/x/xerrors"
)

// ExposedPort represents an exposed pprt
type ExposedPort struct {
	LocalPort uint32
	URL       string
	Public    bool
}

// ExposedPortsInterface provides access to port exposure
type ExposedPortsInterface interface {
	// Observe starts observing the exposed ports until the context is canceled.
	// The list of exposed ports is always the complete picture, i.e. if a single port changes,
	// the whole list is returned.
	// When the observer stops operating (because the context as canceled or an irrecoverable
	// error occured), the observer will close both channels.
	Observe(ctx context.Context) (<-chan []ExposedPort, <-chan error)

	// Run starts listening to expose port requests.
	Run(ctx context.Context)

	// Expose exposes a port to the internet. Upon successful execution any Observer will be updated.
	Expose(ctx context.Context, port uint32, public bool) <-chan error

	// TriggerUpdate requests a workspace instance update and sends an update to
	// the channel that has been returned by Observe()
	TriggerUpdate(ctx context.Context) error
}

// NoopExposedPorts implements ExposedPortsInterface but does nothing
type NoopExposedPorts struct{}

// Observe starts observing the exposed ports until the context is canceled.
func (*NoopExposedPorts) Observe(ctx context.Context) (<-chan []ExposedPort, <-chan error) {
	return make(<-chan []ExposedPort), make(<-chan error)
}

// Run starts listening to expose port requests.
func (*NoopExposedPorts) Run(ctx context.Context) {}

// Expose exposes a port to the internet. Upon successful execution any Observer will be updated.
func (*NoopExposedPorts) Expose(ctx context.Context, local uint32, public bool) <-chan error {
	done := make(chan error)
	close(done)
	return done
}

func (*NoopExposedPorts) TriggerUpdate(ctx context.Context) error {
	return nil
}

// GitpodExposedPorts uses a connection to the Gitpod server to implement
// the ExposedPortsInterface.
type GitpodExposedPorts struct {
	WorkspaceID string
	InstanceID  string
	C           gitpod.APIInterface

	minExposeDelay        time.Duration
	maxExposeAttempts     uint32
	exposeDelayGrowFactor float64

	requests chan *exposePortRequest

	exposedPorts chan []ExposedPort
}

type exposePortRequest struct {
	port *gitpod.WorkspaceInstancePort
	ctx  context.Context
	done chan error
}

// NewGitpodExposedPorts creates a new instance of GitpodExposedPorts
func NewGitpodExposedPorts(workspaceID string, instanceID string, gitpodService gitpod.APIInterface) *GitpodExposedPorts {
	return &GitpodExposedPorts{
		WorkspaceID: workspaceID,
		InstanceID:  instanceID,
		C:           gitpodService,

		minExposeDelay:        2 * time.Second,
		maxExposeAttempts:     5,
		exposeDelayGrowFactor: 1.5,

		// allow clients to submit 30 expose requests without blocking
		requests: make(chan *exposePortRequest, 30),
	}
}

// Observe starts observing the exposed ports until the context is canceled.
func (g *GitpodExposedPorts) Observe(ctx context.Context) (<-chan []ExposedPort, <-chan error) {
	errchan := make(chan error, 1)
	g.exposedPorts = make(chan []ExposedPort)

	go func() {
		defer func() {
			close(g.exposedPorts)
			g.exposedPorts = nil
		}()
		defer close(errchan)

		updates, err := g.C.InstanceUpdates(ctx, g.InstanceID)
		if err != nil {
			errchan <- err
			return
		}
		for {
			select {
			case u := <-updates:
				res := getExposedPorts(u)
				if res == nil {
					return
				}
				g.exposedPorts <- res
			case <-ctx.Done():
				return
			}
		}
	}()

	return g.exposedPorts, errchan
}

func getExposedPorts(wsInstance *gitpod.WorkspaceInstance) []ExposedPort {
	if wsInstance == nil {
		return nil
	}

	res := make([]ExposedPort, len(wsInstance.Status.ExposedPorts))
	for i, p := range wsInstance.Status.ExposedPorts {
		res[i] = ExposedPort{
			LocalPort: uint32(p.Port),
			Public:    p.Visibility == "public",
			URL:       p.URL,
		}
	}
	return res
}

func (g *GitpodExposedPorts) TriggerUpdate(ctx context.Context) error {
	if g.exposedPorts == nil {
		return nil
	}

	wsInfo, err := g.C.GetWorkspace(ctx, g.WorkspaceID)
	if err != nil {
		return err
	}
	res := getExposedPorts(wsInfo.LatestInstance)
	if res == nil {
		return xerrors.Errorf("no workspace instance")
	}
	g.exposedPorts <- res
	return nil
}

// Listen starts listening to expose port requests
func (g *GitpodExposedPorts) Run(ctx context.Context) {
	// process multiple parallel requests but process one by one to avoid server/ws-manager rate limitting
	// if it does not help then we try to expose the same port again with the exponential backoff.
	for {
		select {
		case <-ctx.Done():
			return
		case req := <-g.requests:
			g.doExpose(req)
		}
	}
}

func (g *GitpodExposedPorts) doExpose(req *exposePortRequest) {
	var err error
	defer func() {
		if err != nil {
			req.done <- err
		}
		close(req.done)
	}()
	delay := g.minExposeDelay
	attempt := 0
	for {
		_, err = g.C.OpenPort(req.ctx, g.WorkspaceID, req.port)
		if err == nil || req.ctx.Err() != nil || attempt == 5 {
			return
		}
		log.WithError(err).WithField("port", req.port).Warnf("cannot expose port, trying again in %d seconds...", uint32(delay.Seconds()))
		select {
		case <-req.ctx.Done():
			err = req.ctx.Err()
			return
		case <-time.After(delay):
			delay = time.Duration(float64(delay) * g.exposeDelayGrowFactor)
			attempt++
		}
	}
}

// Expose exposes a port to the internet. Upon successful execution any Observer will be updated.
func (g *GitpodExposedPorts) Expose(ctx context.Context, local uint32, public bool) <-chan error {
	v := "private"
	if public {
		v = "public"
	}
	req := &exposePortRequest{
		port: &gitpod.WorkspaceInstancePort{
			Port:       float64(local),
			Visibility: v,
		},
		ctx:  ctx,
		done: make(chan error),
	}
	g.requests <- req
	return req.done
}
