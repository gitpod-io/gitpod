// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"testing"
	"time"

	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/envtest"

	"github.com/gitpod-io/gitpod/common-go/util"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/layer"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
)

// This file contains test infrastructure for this package. No function in here is meant for consumption outside of tests.
//
// Why is this even here and not in some other package like internal/testing?
//    Because we need to modify package internal state
//

// forTestingOnlyGetManager creates a workspace manager instance for testing purposes
func forTestingOnlyGetManager(t *testing.T, objects ...client.Object) *Manager {
	config := config.Configuration{
		Namespace:                "default",
		SchedulerName:            "workspace-scheduler",
		SeccompProfile:           "localhost/workspace-default",
		HeartbeatInterval:        util.Duration(30 * time.Second),
		WorkspaceHostPath:        "/tmp/workspaces",
		GitpodHostURL:            "gitpod.io",
		WorkspaceURLTemplate:     "{{ .ID }}-{{ .Prefix }}-{{ .Host }}",
		WorkspacePortURLTemplate: "{{ .WorkspacePort }}-{{ .ID }}-{{ .Prefix }}-{{ .Host }}",
		RegistryFacadeHost:       "registry-facade:8080",
		Container: config.AllContainerConfiguration{
			Workspace: config.ContainerConfiguration{
				Image: "workspace-image",
				Limits: config.ResourceConfiguration{
					CPU:    "900m",
					Memory: "1000M",
				},
				Requests: config.ResourceConfiguration{
					CPU:     "899m",
					Memory:  "999M",
					Storage: "5Gi",
				},
			},
		},
		Timeouts: config.WorkspaceTimeoutConfiguration{
			AfterClose:          util.Duration(1 * time.Minute),
			Initialization:      util.Duration(30 * time.Minute),
			TotalStartup:        util.Duration(45 * time.Minute),
			RegularWorkspace:    util.Duration(60 * time.Minute),
			HeadlessWorkspace:   util.Duration(90 * time.Minute),
			Stopping:            util.Duration(60 * time.Minute),
			ContentFinalization: util.Duration(55 * time.Minute),
			Interrupted:         util.Duration(5 * time.Minute),
		},
	}

	testEnv := &envtest.Environment{}
	cfg, err := testEnv.Start()
	if err != nil {
		t.Errorf("cannot create test environment: %v", err)
		return nil
	}

	t.Cleanup(func() {
		err = testEnv.Stop()
		if err != nil {
			t.Logf("unexpected error stopping test cluster: %v", err)
		}
	})

	clientset, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		t.Errorf("cannot create test environment: %v", err)
		return nil
	}

	ctrlClient, err := client.New(cfg, client.Options{Scheme: scheme})
	if err != nil {
		t.Errorf("cannot create test environment: %v", err)
		return nil
	}

	for _, obj := range objects {
		err := ctrlClient.Create(context.Background(), obj)
		if err != nil {
			t.Errorf("cannot create test environment objects: %v", err)
			return nil
		}
	}

	m, err := New(config, ctrlClient, clientset, &layer.Provider{Storage: &storage.PresignedNoopStorage{}})
	if err != nil {
		t.Fatalf("cannot create manager: %s", err.Error())
	}
	// we don't have propr DNS resolution and network access - and we cannot mock it
	m.Config.InitProbe.Disabled = true

	return m
}

// forTestingOnlyCreateStartWorkspaceContext creates a bare miminum startWorkspaceContext
// which can be used to create a mock workspace pod.
func forTestingOnlyCreateStartWorkspaceContext(manager *Manager, id string, tpe api.WorkspaceType) (*startWorkspaceContext, error) {
	return manager.newStartWorkspaceContext(context.Background(), &api.StartWorkspaceRequest{
		Id:            id,
		ServicePrefix: "servicePrefix",
		Type:          tpe,
		Metadata: &api.WorkspaceMetadata{
			Owner:  "foobar",
			MetaId: "foobar",
		},
		Spec: &api.StartWorkspaceSpec{
			WorkspaceImage: "foobar",
			IdeImage:       "someide:version.0",
			Ports:          []*api.PortSpec{},
			Initializer:    &csapi.WorkspaceInitializer{},
		},
	})
}
