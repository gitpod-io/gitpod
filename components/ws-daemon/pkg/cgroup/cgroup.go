// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroup

import (
	"context"
	"errors"

	"github.com/gitpod-io/gitpod/common-go/cgroups"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
)

func NewPluginHost(cgroupBasePath string, plugins ...Plugin) (*PluginHost, error) {
	var version Version
	unified, err := cgroups.IsUnifiedCgroupSetup()
	if err != nil {
		return nil, xerrors.Errorf("could not determine cgroup setup: %w", err)
	}
	if unified {
		version = Version2
	} else {
		version = Version1
	}

	return &PluginHost{
		CGroupBasePath: cgroupBasePath,
		CGroupVersion:  version,
		Plugins:        plugins,

		pluginActivationTotalVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "cgroup_plugin_activation_total",
			Help: "counts the total activation of cgroup plugins",
		}, []string{"plugin", "success"}),
	}, nil
}

type PluginHost struct {
	CGroupBasePath string
	CGroupVersion  Version
	Plugins        []Plugin

	pluginActivationTotalVec *prometheus.CounterVec
}

var _ dispatch.Listener = &PluginHost{}
var _ prometheus.Collector = &PluginHost{}

func (host *PluginHost) Describe(c chan<- *prometheus.Desc) {
	host.pluginActivationTotalVec.Describe(c)
	for _, p := range host.Plugins {
		col, ok := p.(prometheus.Collector)
		if !ok {
			continue
		}

		col.Describe(c)
	}
}

func (host *PluginHost) Collect(c chan<- prometheus.Metric) {
	host.pluginActivationTotalVec.Collect(c)
	for _, p := range host.Plugins {
		col, ok := p.(prometheus.Collector)
		if !ok {
			continue
		}

		col.Collect(c)
	}
}

func (host *PluginHost) WorkspaceAdded(ctx context.Context, ws *dispatch.Workspace) (err error) {
	disp := dispatch.GetFromContext(ctx)
	if disp == nil {
		return xerrors.Errorf("no dispatch available")
	}

	cgroupPath, err := disp.Runtime.ContainerCGroupPath(ctx, ws.ContainerID)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return nil
		}
		return xerrors.Errorf("cannot get cgroup path for container %s: %w", ws.ContainerID, err)
	}

	opts := &PluginOptions{
		BasePath:    host.CGroupBasePath,
		CgroupPath:  cgroupPath,
		InstanceId:  ws.InstanceID,
		Annotations: ws.Pod.Annotations,
	}

	for _, plg := range host.Plugins {
		if plg.Type() != host.CGroupVersion {
			continue
		}
		dispatch.GetDispatchWaitGroup(ctx).Add(1)

		go func(plg Plugin) {
			defer dispatch.GetDispatchWaitGroup(ctx).Done()

			err := plg.Apply(ctx, opts)
			if err == context.Canceled || err == context.DeadlineExceeded {
				err = nil
			}
			if err != nil {
				log.WithError(err).WithFields(ws.OWI()).WithField("plugin", plg.Name()).Error("cgroup plugin failure")
				host.pluginActivationTotalVec.WithLabelValues(plg.Name(), "false").Inc()
			} else {
				host.pluginActivationTotalVec.WithLabelValues(plg.Name(), "true").Inc()
			}
		}(plg)
	}

	return nil
}

type Plugin interface {
	Name() string
	Type() Version
	Apply(ctx context.Context, options *PluginOptions) error
}

type Version int

const (
	Version1 Version = iota
	Version2
)

type PluginOptions struct {
	BasePath    string
	CgroupPath  string
	InstanceId  string
	Annotations map[string]string
}
