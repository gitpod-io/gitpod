// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/envtest"

	"github.com/gitpod-io/gitpod/common-go/util"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/layer"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"

	volumesnapshotclientv1 "github.com/kubernetes-csi/external-snapshotter/client/v4/clientset/versioned"
)

// This file contains test infrastructure for this package. No function in here is meant for consumption outside of tests.
//
// Why is this even here and not in some other package like internal/testing?
//    Because we need to modify package internal state
//

func forTestingOnlyManagerConfig() config.Configuration {
	return config.Configuration{
		Namespace:                "default",
		SeccompProfile:           "workspace-default",
		HeartbeatInterval:        util.Duration(30 * time.Second),
		WorkspaceHostPath:        "/tmp/workspaces",
		GitpodHostURL:            "gitpod.io",
		WorkspaceURLTemplate:     "{{ .ID }}-{{ .Prefix }}-{{ .Host }}",
		WorkspacePortURLTemplate: "{{ .WorkspacePort }}-{{ .ID }}-{{ .Prefix }}-{{ .Host }}",
		RegistryFacadeHost:       "registry-facade:8080",
		WorkspaceClasses: map[string]*config.WorkspaceClass{
			config.DefaultWorkspaceClass: {
				Container: config.ContainerConfiguration{
					Limits: &config.ResourceLimitConfiguration{
						CPU: &config.CpuResourceLimit{
							MinLimit:   "300m",
							BurstLimit: "900m",
						},
						Memory: "1000M",
					},
					Requests: &config.ResourceRequestConfiguration{
						CPU:              "899m",
						EphemeralStorage: "5Gi",
						Memory:           "999M",
					},
				},
			},
		},
		Timeouts: config.WorkspaceTimeoutConfiguration{
			AfterClose:          util.Duration(1 * time.Minute),
			Initialization:      util.Duration(30 * time.Minute),
			TotalStartup:        util.Duration(45 * time.Minute),
			RegularWorkspace:    util.Duration(60 * time.Minute),
			MaxLifetime:         util.Duration(36 * time.Hour),
			HeadlessWorkspace:   util.Duration(90 * time.Minute),
			Stopping:            util.Duration(60 * time.Minute),
			ContentFinalization: util.Duration(55 * time.Minute),
			Interrupted:         util.Duration(5 * time.Minute),
		},
	}
}

// forTestingOnlyGetManager creates a workspace manager instance for testing purposes
func forTestingOnlyGetManager(t *testing.T, objects ...client.Object) *Manager {
	config := forTestingOnlyManagerConfig()

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

	volumesnapshotclientset, err := volumesnapshotclientv1.NewForConfig(cfg)
	if err != nil {
		t.Errorf("cannt create test environment: %v", err)
		return nil
	}

	ctrlClient, err := client.New(cfg, client.Options{Scheme: scheme})
	if err != nil {
		t.Errorf("cannot create test environment: %v", err)
		return nil
	}

	err = wait.PollImmediate(5*time.Second, 1*time.Minute, func() (bool, error) {
		err := ctrlClient.Get(context.Background(), types.NamespacedName{Name: "default"}, &corev1.Namespace{})
		if err != nil {
			return false, nil
		}
		return true, nil
	})
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

	m, err := New(config, ctrlClient, clientset, volumesnapshotclientset, &layer.Provider{Storage: &storage.PresignedNoopStorage{}})
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
			IdeImage:       &api.IDEImage{WebRef: "someide:version.0"},
			Ports:          []*api.PortSpec{},
			Initializer:    &csapi.WorkspaceInitializer{},
		},
	})
}
