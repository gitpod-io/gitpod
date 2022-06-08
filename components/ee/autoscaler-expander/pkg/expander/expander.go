// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package expander

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
	gce "google.golang.org/api/compute/v1"
	"google.golang.org/grpc"
	gce_cloudprovider "k8s.io/autoscaler/cluster-autoscaler/cloudprovider/gce"
	"k8s.io/autoscaler/cluster-autoscaler/expander/grpcplugin/protos"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// NewAutoscalerExpander produces a new autoscaler expander.
// Using a configuration file is possible to define the density per node of workspace classes
// The expander allows the override of the number of nodes obtained only with pod definitions
func NewAutoscalerExpander(config Config, reg prometheus.Registerer) (*AutoscalerExpander, error) {
	client, err := newGceClient()
	if err != nil {
		return nil, err
	}

	project, location, err := getProjectAndLocation(true)
	if err != nil {
		return nil, xerrors.Errorf("unexpected error obtaining project details: %v", err)
	}

	ae := &AutoscalerExpander{
		config: &config,
		gce:    client,

		project:  project,
		location: location,
	}

	var configReloader CompositeConfigReloader
	configReloader = append(configReloader, ConfigReloaderFunc(func(ctx context.Context, config *Config) error {
		ae.config = config
		return nil
	}))

	ae.configReloader = configReloader

	return ae, nil
}

type AutoscalerExpander struct {
	configReloader ConfigReloader

	config *Config

	gce *gce.Service

	project  string
	location string
}

func (ae *AutoscalerExpander) BestOptions(ctx context.Context, req *protos.BestOptionsRequest) (*protos.BestOptionsResponse, error) {
	expansionOptions := req.GetOptions()
	log.Infof("Received BestOption Request with %v options", len(expansionOptions))

	for _, option := range expansionOptions {
		nodeGroupId := option.NodeGroupId

		project, zone, instanceGroup, err := gce_cloudprovider.ParseMigUrl(nodeGroupId)
		if err != nil {
			log.WithError(err).WithField("nodeGroupId", nodeGroupId).Errorf("unexpected error parsing MIG")
			continue
		}

		found := false

		for nodeGroupPrefix, maxPendingPods := range ae.config.WorkspaceClassPerNode {
			if !strings.HasPrefix(instanceGroup, nodeGroupPrefix) {
				continue
			}

			found = true

			pendingPods := len(option.Pod)
			if maxPendingPods >= pendingPods {
				log.WithField("pendingPods", pendingPods).WithField("maxPendingPods", maxPendingPods).Info("no need to add additional nodes")
				break
			}

			go func() {
				time.Sleep(10 * time.Second)

				igm, err := ae.gce.InstanceGroupManagers.Get(project, zone, instanceGroup).Do()
				if err != nil {
					log.WithError(err).WithField("nodeGroupId", nodeGroupId).Errorf("unexpected error obtaining MIG details")
					return
				}

				instances := igm.TargetSize + 1
				log.WithField("nodeGroupId", nodeGroupId).WithField("count", instances).Infof("increasing MIG size")
				op, err := ae.gce.InstanceGroupManagers.Resize(project, zone, instanceGroup, instances).Do()
				if err != nil {
					log.WithError(err).WithField("nodeGroupId", nodeGroupId).Errorf("waiting MIG scale-up")
					return
				}

				err = waitForOp(op, project, zone, ae.gce)
				if err != nil {
					log.WithError(err).WithField("nodeGroupId", nodeGroupId).Errorf("waiting MIG operation")
				}
			}()
		}

		if !found {
			log.Warnf(`node group '%s' not found in expander configuration. The group won't be used`, nodeGroupId)
			continue
		}

		break
	}

	return &protos.BestOptionsResponse{
		Options: expansionOptions,
	}, nil
}

// Register registers all gRPC services
func (ae *AutoscalerExpander) Register(srv *grpc.Server) {
	protos.RegisterExpanderServer(srv, ae)
}

func (ae *AutoscalerExpander) ReloadConfig(ctx context.Context, cfg *Config) error {
	return ae.configReloader.ReloadConfig(ctx, cfg)
}

func waitForOp(operation *gce.Operation, project, zone string, client *gce.Service) error {
	for start := time.Now(); time.Since(start) < 1*time.Minute; time.Sleep(1 * time.Second) {
		log.Infof("Waiting for operation %s %s %s", project, zone, operation.Name)
		if op, err := client.ZoneOperations.Get(project, zone, operation.Name).Do(); err == nil {
			log.Infof("Operation %s %s %s status: %s", project, zone, operation.Name, op.Status)
			if op.Status == "DONE" {
				if op.Error != nil {
					return fmt.Errorf("error while getting operation %s on %s: %v", operation.Name, operation.TargetLink, err)
				}

				return nil
			}
		} else {
			log.Warningf("Error while getting operation %s on %s: %v", operation.Name, operation.TargetLink, err)
		}
	}
	return fmt.Errorf("timeout while waiting for operation %s on %s to complete.", operation.Name, operation.TargetLink)
}
