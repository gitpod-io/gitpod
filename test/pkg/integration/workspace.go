// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package integration

import (
	"context"
	"fmt"
	"time"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	imgbldr "github.com/gitpod-io/gitpod/image-builder/api"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	gitpodBuiltinUserID = "builtin-user-workspace-probe-0000000"
)

type launchWorkspaceDirectlyOptions struct {
	BaseImage string
	IdeImage  string
	Mods      []func(*wsmanapi.StartWorkspaceRequest) error
}

// LaunchWorkspaceDirectlyOpt configures the behaviour of LaunchWorkspaceDirectly
type LaunchWorkspaceDirectlyOpt func(*launchWorkspaceDirectlyOptions) error

// WithoutWorkspaceImage prevents the image-builder based base image resolution and sets
// the workspace image to an empty string.
// Usually callers would then use WithRequestModifier to set the workspace image themselves.
func WithoutWorkspaceImage() LaunchWorkspaceDirectlyOpt {
	return func(lwdo *launchWorkspaceDirectlyOptions) error {
		lwdo.BaseImage = ""
		return nil
	}
}

// WithBaseImage configures the base image used to start the workspace. The base image
// will be resolved to a workspace image using the image builder. If the corresponding
// workspace image isn't built yet, it will NOT be built.
func WithBaseImage(baseImage string) LaunchWorkspaceDirectlyOpt {
	return func(lwdo *launchWorkspaceDirectlyOptions) error {
		lwdo.BaseImage = baseImage
		return nil
	}
}

// WithIDEImage configures the IDE image used to start the workspace. Using this option
// as compared to setting the image using a modifier prevents the image ref computation
// based on the server's configuration.
func WithIDEImage(ideImage string) LaunchWorkspaceDirectlyOpt {
	return func(lwdo *launchWorkspaceDirectlyOptions) error {
		lwdo.IdeImage = ideImage
		return nil
	}
}

// WithRequestModifier modifies the start workspace request before it's sent.
func WithRequestModifier(mod func(*wsmanapi.StartWorkspaceRequest) error) LaunchWorkspaceDirectlyOpt {
	return func(lwdo *launchWorkspaceDirectlyOptions) error {
		lwdo.Mods = append(lwdo.Mods, mod)
		return nil
	}
}

// LaunchWorkspaceDirectlyResult is returned by LaunchWorkspaceDirectly
type LaunchWorkspaceDirectlyResult struct {
	Req    *wsmanapi.StartWorkspaceRequest
	IdeURL string
}

// LaunchWorkspaceDirectly starts a workspace pod by talking directly to ws-manager.
// Whenever possible prefer this function over LaunchWorkspaceFromContextURL, because
// it has fewer prerequisites.
func LaunchWorkspaceDirectly(it *Test, opts ...LaunchWorkspaceDirectlyOpt) (res *LaunchWorkspaceDirectlyResult) {
	options := launchWorkspaceDirectlyOptions{
		BaseImage: "gitpod/workspace-full:latest",
	}
	for _, o := range opts {
		err := o(&options)
		if err != nil {
			it.t.Fatal(err)
			return
		}
	}

	instanceID, err := uuid.NewRandom()
	if err != nil {
		it.t.Fatal(err)
		return
	}
	workspaceID, err := uuid.NewRandom()
	if err != nil {
		it.t.Fatal(err)
		return
	}

	var workspaceImage string
	if options.BaseImage != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		cl := it.API().ImageBuilder()
		reslv, err := cl.ResolveWorkspaceImage(ctx, &imgbldr.ResolveWorkspaceImageRequest{
			Source: &imgbldr.BuildSource{
				From: &imgbldr.BuildSource_Ref{
					Ref: &imgbldr.BuildSourceReference{
						Ref: options.BaseImage,
					},
				},
			},
			Auth: &imgbldr.BuildRegistryAuth{
				Mode: &imgbldr.BuildRegistryAuth_Total{
					Total: &imgbldr.BuildRegistryAuthTotal{
						AllowAll: true,
					},
				},
			},
		})
		cancel()
		if err != nil {
			it.t.Fatal(err)
			return
		}
		workspaceImage = reslv.Ref
	}

	ideImage := options.IdeImage
	if ideImage == "" {
		pods, err := it.clientset.CoreV1().Pods(it.namespace).List(metav1.ListOptions{
			LabelSelector: "component=server",
		})
		if err != nil {
			it.t.Fatalf("cannot find server pod: %q", err)
		}
		theiaImage, err := envvarFromPod(pods, "THEIA_IMAGE_REPO")
		if err != nil {
			it.t.Fatal(err)
		}
		version, err := envvarFromPod(pods, "VERSION")
		if err != nil {
			it.t.Fatal(err)
		}
		ideImage = fmt.Sprintf("%s:%s", theiaImage, version)
	}

	req := &wsmanapi.StartWorkspaceRequest{
		Id:            instanceID.String(),
		ServicePrefix: workspaceID.String(),
		Metadata: &wsmanapi.WorkspaceMetadata{
			Owner:  gitpodBuiltinUserID,
			MetaId: workspaceID.String(),
		},
		Type: wsmanapi.WorkspaceType_REGULAR,
		Spec: &wsmanapi.StartWorkspaceSpec{
			WorkspaceImage:    workspaceImage,
			IdeImage:          ideImage,
			CheckoutLocation:  "/",
			WorkspaceLocation: "/",
			Timeout:           "30m",
			Initializer: &csapi.WorkspaceInitializer{
				Spec: &csapi.WorkspaceInitializer_Empty{
					Empty: &csapi.EmptyInitializer{},
				},
			},
			Git: &wsmanapi.GitSpec{
				Username: "integration-test",
				Email:    "integration-test@gitpod.io",
			},
			Admission: wsmanapi.AdmissionLevel_ADMIT_OWNER_ONLY,
		},
	}
	for _, m := range options.Mods {
		err := m(req)
		if err != nil {
			it.t.Fatal(err)
			return
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	sresp, err := it.API().WorkspaceManager().StartWorkspace(ctx, req)
	cancel()
	if err != nil {
		it.t.Fatalf("cannot start workspace: %q", err)
	}

	time.Sleep(2 * time.Second)

	ctx, cancel = context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	it.WaitForWorkspace(ctx, instanceID.String())

	it.t.Logf("workspace is running: instanceID=%s", instanceID.String())

	return &LaunchWorkspaceDirectlyResult{
		Req:    req,
		IdeURL: sresp.Url,
	}
}

// LaunchWorkspaceFromContextURL force-creates a new workspace using the Gitpod server API,
// and waits for the workspace to start. If any step along the way fails, this function will
// fail the test.
//
// When possible, prefer the less complex LaunchWorkspaceDirectly.
func LaunchWorkspaceFromContextURL(it *Test, contextURL string) *protocol.WorkspaceInfo {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	server := it.API().GitpodServer()
	resp, err := server.CreateWorkspace(ctx, &protocol.CreateWorkspaceOptions{
		ContextURL: "github.com/gitpod-io/gitpod",
		Mode:       "force-new",
	})
	if err != nil {
		it.t.Fatalf("cannot start workspace: %q", err)
	}
	defer func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 10*time.Second)
		err := server.StopWorkspace(cctx, resp.CreatedWorkspaceID)
		ccancel()
		if err != nil {
			it.t.Errorf("cannot stop workspace: %q", err)
		}
	}()
	it.t.Logf("created workspace: workspaceID=%s url=%s", resp.CreatedWorkspaceID, resp.WorkspaceURL)

	nfo, err := server.GetWorkspace(ctx, resp.CreatedWorkspaceID)
	if err != nil {
		it.t.Fatalf("cannot get workspace: %q", err)
	}
	if nfo.LatestInstance == nil {
		it.t.Fatal("CreateWorkspace did not start the workspace")
	}

	ctx, cancel = context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	it.WaitForWorkspace(ctx, nfo.LatestInstance.ID)

	it.t.Logf("workspace is running: instanceID=%s", nfo.LatestInstance.ID)

	return nfo
}

// WaitForWorkspace waits until a workspace is running. Fails the test if the workspace
// fails or does not become RUNNING before the context is canceled.
func (t *Test) WaitForWorkspace(ctx context.Context, instanceID string) {
	wsman := t.API().WorkspaceManager()
	sub, err := wsman.Subscribe(ctx, &wsmanapi.SubscribeRequest{})
	if err != nil {
		t.t.Fatalf("cannot listen for workspace updates: %q", err)
		return
	}
	defer sub.CloseSend()

	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			resp, err := sub.Recv()
			if err != nil {
				t.t.Fatalf("workspace update error: %q", err)
				return
			}
			status := resp.GetStatus()
			if status == nil {
				continue
			}
			if status.Id != instanceID {
				continue
			}

			if status.Conditions.Failed != "" {
				t.t.Fatalf("workspace instance %s failed: %s", instanceID, status.Conditions.Failed)
				return
			}
			if status.Phase == wsmanapi.WorkspacePhase_STOPPING {
				t.t.Fatalf("workspace instance %s is stopping", instanceID)
				return
			}
			if status.Phase == wsmanapi.WorkspacePhase_STOPPED {
				t.t.Fatalf("workspace instance %s has stopped", instanceID)
				return
			}
			if status.Phase != wsmanapi.WorkspacePhase_RUNNING {
				// we're still starting
				continue
			}

			// all is well, the workspace is running
			return
		}
	}()

	// maybe the workspace has started in the meantime and we've missed the update
	desc, _ := wsman.DescribeWorkspace(ctx, &wsmanapi.DescribeWorkspaceRequest{Id: instanceID})
	if desc != nil {
		switch desc.Status.Phase {
		case wsmanapi.WorkspacePhase_RUNNING:
			return
		case wsmanapi.WorkspacePhase_STOPPING:
			t.t.Fatalf("workspace instance %s is stopping", instanceID)
			return
		case wsmanapi.WorkspacePhase_STOPPED:
			t.t.Fatalf("workspace instance %s has stopped", instanceID)
			return
		}
	}

	select {
	case <-ctx.Done():
		t.t.Fatalf("cannot wait for workspace: %q", ctx.Err())
	case <-done:
	}
}

// WaitForWorkspaceStop waits until a workspace is stopped. Fails the test if the workspace
// fails or does not stop before the context is canceled.
func (t *Test) WaitForWorkspaceStop(ctx context.Context, instanceID string) (lastStatus *wsmanapi.WorkspaceStatus) {
	wsman := t.API().WorkspaceManager()
	sub, err := wsman.Subscribe(ctx, &wsmanapi.SubscribeRequest{})
	if err != nil {
		t.t.Fatalf("cannot listen for workspace updates: %q", err)
		return
	}
	defer sub.CloseSend()

	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			resp, err := sub.Recv()
			if err != nil {
				t.t.Fatalf("workspace update error: %q", err)
				return
			}
			status := resp.GetStatus()
			if status == nil {
				continue
			}
			if status.Id != instanceID {
				continue
			}

			if status.Conditions.Failed != "" {
				t.t.Fatalf("workspace instance %s failed: %s", instanceID, status.Conditions.Failed)
				return
			}
			if status.Phase == wsmanapi.WorkspacePhase_STOPPED {
				lastStatus = status
				return
			}
		}
	}()

	// maybe the workspace has started in the meantime and we've missed the update
	desc, _ := wsman.DescribeWorkspace(ctx, &wsmanapi.DescribeWorkspaceRequest{Id: instanceID})
	if desc != nil {
		switch desc.Status.Phase {
		case wsmanapi.WorkspacePhase_STOPPED:
			return desc.Status
		}
	}

	select {
	case <-ctx.Done():
		t.t.Fatalf("cannot wait for workspace: %q", ctx.Err())
	case <-done:
	}
	return
}

// DeleteWorkspace cleans up a workspace started during an integration test
func DeleteWorkspace(it *Test, instanceID string) {
	err := func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_, err := it.API().WorkspaceManager().StopWorkspace(ctx, &wsmanapi.StopWorkspaceRequest{
			Id: instanceID,
		})
		cancel()

		if err == nil {
			return nil
		}
		s, ok := status.FromError(err)
		if ok && s.Code() == codes.NotFound {
			return nil
		}

		return err
	}()

	if err != nil {
		it.t.Logf("cannot delete workspace: %s", instanceID)
	}
}
