// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package integration

import (
	"context"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/gitpod-io/gitpod/common-go/namegen"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	imgbldr "github.com/gitpod-io/gitpod/image-builder/api"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

const (
	gitpodBuiltinUserID = "builtin-user-workspace-probe-0000000"
	perCallTimeout      = 20 * time.Second
)

type launchWorkspaceDirectlyOptions struct {
	BaseImage   string
	IdeImage    string
	Mods        []func(*wsmanapi.StartWorkspaceRequest) error
	WaitForOpts []WaitForWorkspaceOpt
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

// WithWaitWorkspaceForOpts adds options to the WaitForWorkspace call that happens as part of LaunchWorkspaceDirectly
func WithWaitWorkspaceForOpts(opt ...WaitForWorkspaceOpt) LaunchWorkspaceDirectlyOpt {
	return func(lwdo *launchWorkspaceDirectlyOptions) error {
		lwdo.WaitForOpts = opt
		return nil
	}
}

// LaunchWorkspaceDirectlyResult is returned by LaunchWorkspaceDirectly
type LaunchWorkspaceDirectlyResult struct {
	Req        *wsmanapi.StartWorkspaceRequest
	IdeURL     string
	LastStatus *wsmanapi.WorkspaceStatus
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
	workspaceID, err := namegen.GenerateWorkspaceID()
	if err != nil {
		it.t.Fatal(err)
		return
	}

	var workspaceImage string
	if options.BaseImage != "" {
		workspaceImage, err = it.resolveOrBuildImage(options.BaseImage)
		if err != nil {
			it.t.Fatalf("cannot resolve base image: %v", err)
			return
		}
	}

	ideImage := options.IdeImage
	if ideImage == "" {
		cfg, err := it.GetServerConfig()
		if err != nil {
			it.t.Fatalf("cannot find server config: %q", err)
		}
		ideImage = cfg.WorkspaceDefaults.IDEImageAliases.Code
	}

	req := &wsmanapi.StartWorkspaceRequest{
		Id:            instanceID.String(),
		ServicePrefix: workspaceID,
		Metadata: &wsmanapi.WorkspaceMetadata{
			Owner:  gitpodBuiltinUserID,
			MetaId: workspaceID,
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

	sctx, scancel := context.WithTimeout(it.ctx, perCallTimeout)
	sresp, err := it.API().WorkspaceManager().StartWorkspace(sctx, req)
	scancel()
	if err != nil {
		it.t.Fatalf("cannot start workspace: %q", err)
	}

	lastStatus := it.WaitForWorkspaceStart(it.ctx, instanceID.String(), options.WaitForOpts...)

	it.t.Logf("workspace is running: instanceID=%s", instanceID.String())

	return &LaunchWorkspaceDirectlyResult{
		Req:        req,
		IdeURL:     sresp.Url,
		LastStatus: lastStatus,
	}
}

// LaunchWorkspaceFromContextURL force-creates a new workspace using the Gitpod server API,
// and waits for the workspace to start. If any step along the way fails, this function will
// fail the test.
//
// When possible, prefer the less complex LaunchWorkspaceDirectly.
func LaunchWorkspaceFromContextURL(it *Test, contextURL string, serverOpts ...GitpodServerOpt) (nfo *protocol.WorkspaceInfo, stopWs func(waitForStop bool)) {
	var defaultServerOpts []GitpodServerOpt
	if it.username != "" {
		defaultServerOpts = []GitpodServerOpt{WithGitpodUser(it.username)}
	}
	server := it.API().GitpodServer(append(defaultServerOpts, serverOpts...)...)

	cctx, ccancel := context.WithTimeout(it.ctx, perCallTimeout)
	defer ccancel()
	resp, err := server.CreateWorkspace(cctx, &protocol.CreateWorkspaceOptions{
		ContextURL: contextURL,
		Mode:       "force-new",
	})
	if err != nil {
		it.t.Fatalf("cannot start workspace: %q", err)
	}
	stopWs = func(waitForStop bool) {
		sctx, scancel := context.WithTimeout(it.ctx, perCallTimeout)
		err := server.StopWorkspace(sctx, resp.CreatedWorkspaceID)
		scancel()
		if err != nil {
			it.t.Errorf("cannot stop workspace: %q", err)
		}

		if waitForStop {
			it.WaitForWorkspaceStop(nfo.LatestInstance.ID)
		}
	}
	defer func() {
		if err != nil {
			stopWs(false)
		}
	}()
	it.t.Logf("created workspace: workspaceID=%s url=%s", resp.CreatedWorkspaceID, resp.WorkspaceURL)

	nfo, err = server.GetWorkspace(it.ctx, resp.CreatedWorkspaceID)
	if err != nil {
		it.t.Fatalf("cannot get workspace: %q", err)
	}
	if nfo.LatestInstance == nil {
		err = xerrors.Errorf("CreateWorkspace did not start the workspace")
		it.t.Fatal(err)
	}

	it.WaitForWorkspaceStart(it.ctx, nfo.LatestInstance.ID)

	it.t.Logf("workspace is running: instanceID=%s", nfo.LatestInstance.ID)

	return nfo, stopWs
}

// WaitForWorkspaceOpt configures a WaitForWorkspace call
type WaitForWorkspaceOpt func(*waitForWorkspaceOpts)

type waitForWorkspaceOpts struct {
	CanFail bool
}

// WorkspaceCanFail doesn't fail the test if the workspace fails to start
func WorkspaceCanFail(o *waitForWorkspaceOpts) {
	o.CanFail = true
}

// WaitForWorkspace waits until a workspace is running. Fails the test if the workspace
// fails or does not become RUNNING before the context is canceled.
func (t *Test) WaitForWorkspaceStart(ctx context.Context, instanceID string, opts ...WaitForWorkspaceOpt) (lastStatus *wsmanapi.WorkspaceStatus) {
	var cfg waitForWorkspaceOpts
	for _, o := range opts {
		o(&cfg)
	}

	wsman := t.API().WorkspaceManager()

	var sub wsmanapi.WorkspaceManager_SubscribeClient
	for i := 0; i < 5; i++ {
		var err error
		sub, err = wsman.Subscribe(ctx, &wsmanapi.SubscribeRequest{})
		if status.Code(err) == codes.NotFound {
			time.Sleep(1 * time.Second)
			continue
		}
		if err != nil {
			t.t.Fatalf("cannot listen for workspace updates: %q", err)
			return
		}
		defer func() {
			_ = sub.CloseSend()
		}()
		break
	}

	done := make(chan *wsmanapi.WorkspaceStatus)
	go func() {
		var status *wsmanapi.WorkspaceStatus
		defer func() {
			done <- status
			close(done)
		}()
		for {
			resp, err := sub.Recv()
			if err != nil {
				t.t.Errorf("workspace update error: %q", err)
				return
			}
			status = resp.GetStatus()
			if status == nil {
				continue
			}
			if status.Id != instanceID {
				continue
			}

			if cfg.CanFail {
				if status.Phase == wsmanapi.WorkspacePhase_STOPPING {
					return
				}
				if status.Phase == wsmanapi.WorkspacePhase_STOPPED {
					return
				}
			} else {
				if status.Conditions.Failed != "" {
					t.t.Errorf("workspace instance %s failed: %s", instanceID, status.Conditions.Failed)
					return
				}
				if status.Phase == wsmanapi.WorkspacePhase_STOPPING {
					t.t.Errorf("workspace instance %s is stopping", instanceID)
					return
				}
				if status.Phase == wsmanapi.WorkspacePhase_STOPPED {
					t.t.Errorf("workspace instance %s has stopped", instanceID)
					return
				}
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
			if !cfg.CanFail {
				t.t.Fatalf("workspace instance %s is stopping", instanceID)
			}
			return
		case wsmanapi.WorkspacePhase_STOPPED:
			if !cfg.CanFail {
				t.t.Fatalf("workspace instance %s has stopped", instanceID)
			}
			return
		}
	}

	select {
	case <-ctx.Done():
		t.t.Fatalf("cannot wait for workspace: %q", ctx.Err())
		return nil
	case s := <-done:
		return s
	}
}

// WaitForWorkspaceStop waits until a workspace is stopped. Fails the test if the workspace
// fails or does not stop before the context is canceled.
func (it *Test) WaitForWorkspaceStop(instanceID string) (lastStatus *wsmanapi.WorkspaceStatus) {
	wsman := it.API().WorkspaceManager()
	sub, err := wsman.Subscribe(it.ctx, &wsmanapi.SubscribeRequest{})
	if err != nil {
		it.t.Fatalf("cannot listen for workspace updates: %q", err)
		return
	}
	defer func() {
		_ = sub.CloseSend()
	}()

	var workspaceID string
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			resp, err := sub.Recv()
			if err != nil {
				it.t.Errorf("workspace update error: %q", err)
				return
			}
			status := resp.GetStatus()
			if status == nil {
				continue
			}
			if status.Id != instanceID {
				continue
			}

			workspaceID = status.Metadata.MetaId
			if status.Conditions.Failed != "" {
				it.t.Errorf("workspace instance %s failed: %s", instanceID, status.Conditions.Failed)
				return
			}
			if status.Phase == wsmanapi.WorkspacePhase_STOPPED {
				lastStatus = status
				return
			}
		}
	}()

	// maybe the workspace has stopped in the meantime and we've missed the update
	desc, _ := wsman.DescribeWorkspace(it.ctx, &wsmanapi.DescribeWorkspaceRequest{Id: instanceID})
	if desc != nil {
		switch desc.Status.Phase {
		case wsmanapi.WorkspacePhase_STOPPED:
			// ensure theia service is cleaned up
			lastStatus = desc.Status
		}
	}

	select {
	case <-it.ctx.Done():
		it.t.Fatalf("cannot wait for workspace stop: %q", it.ctx.Err())
		return
	case <-done:
	}

	// wait for the Theia service to be properly deleted
	ctx, cancel := context.WithTimeout(it.ctx, 30*time.Second)
	defer cancel()
	var (
		start       = time.Now()
		serviceGone bool
		k8s, ns     = it.API().Kubernetes()
	)

	// NOTE: this needs to be kept in sync with components/ws-manager/pkg/manager/manager.go:getTheiaServiceName()
	// TODO(rl) expose it?
	theiaName := fmt.Sprintf("ws-%s-theia", strings.TrimSpace(strings.ToLower(workspaceID)))
	for time.Since(start) < 1*time.Minute {
		_, err := k8s.CoreV1().Services(ns).Get(ctx, theiaName, v1.GetOptions{})
		if errors.IsNotFound(err) {
			serviceGone = true
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	if !serviceGone {
		it.t.Fatalf("Theia service:%s did not disappear in time", theiaName)
		return
	}
	// Wait for the theia endpoints to be properly deleted (i.e. syncing)
	var endpointGone bool
	for time.Since(start) < 1*time.Minute {
		_, err := k8s.CoreV1().Endpoints(ns).Get(ctx, theiaName, v1.GetOptions{})
		if errors.IsNotFound(err) {
			endpointGone = true
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	if !endpointGone {
		it.t.Fatalf("Theia endpoint:%s did not disappear in time", theiaName)
		return
	}

	return
}

// WaitForWorkspace waits until the condition function returns true. Fails the test if the condition does
// not become true before the context is canceled.
func (it *Test) WaitForWorkspace(instanceID string, condition func(status *wsmanapi.WorkspaceStatus) bool) (lastStatus *wsmanapi.WorkspaceStatus) {
	wsman := it.API().WorkspaceManager()
	sub, err := wsman.Subscribe(it.ctx, &wsmanapi.SubscribeRequest{})
	if err != nil {
		it.t.Errorf("cannot listen for workspace updates: %q", err)
		return
	}

	done := make(chan *wsmanapi.WorkspaceStatus, 1)
	var once sync.Once
	go func() {
		var status *wsmanapi.WorkspaceStatus
		defer func() {
			once.Do(func() {
				done <- status
				close(done)
			})
			_ = sub.CloseSend()
		}()
		for {
			resp, err := sub.Recv()
			if err == io.EOF {
				return
			}
			if err != nil {
				it.t.Errorf("workspace update error: %q", err)
				return
			}
			status = resp.GetStatus()
			if status == nil {
				continue
			}
			if status.Id != instanceID {
				continue
			}

			if condition(status) {
				return
			}
		}
	}()

	// maybe the workspace has started in the meantime and we've missed the update
	desc, err := wsman.DescribeWorkspace(it.ctx, &wsmanapi.DescribeWorkspaceRequest{Id: instanceID})
	if err != nil {
		it.t.Fatalf("cannot get workspace: %q", err)
		return
	}
	if condition(desc.Status) {
		once.Do(func() { close(done) })
		return desc.Status
	}

	select {
	case <-it.ctx.Done():
		it.t.Fatalf("cannot wait for workspace: %q", it.ctx.Err())
		return
	case s := <-done:
		return s
	}
}

func (it *Test) resolveOrBuildImage(baseRef string) (absref string, err error) {
	rctx, rcancel := context.WithTimeout(it.ctx, perCallTimeout)
	cl := it.API().ImageBuilder()
	reslv, err := cl.ResolveWorkspaceImage(rctx, &imgbldr.ResolveWorkspaceImageRequest{
		Source: &imgbldr.BuildSource{
			From: &imgbldr.BuildSource_Ref{
				Ref: &imgbldr.BuildSourceReference{
					Ref: baseRef,
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
	rcancel()
	if err != nil {
		return
	}

	if reslv.Status == imgbldr.BuildStatus_done_success {
		return reslv.Ref, nil
	}

	it.t.Log("workspace image isn't built - building now")

	rctx, rcancel = context.WithTimeout(it.ctx, 5*time.Minute)
	defer rcancel()
	bld, err := cl.Build(rctx, &imgbldr.BuildRequest{
		Source: &imgbldr.BuildSource{
			From: &imgbldr.BuildSource_Ref{
				Ref: &imgbldr.BuildSourceReference{
					Ref: baseRef,
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
	if err != nil {
		return
	}

	for {
		resp, err := bld.Recv()
		if err != nil {
			return "", err
		}

		if resp.Status == imgbldr.BuildStatus_done_success {
			break
		} else if resp.Status == imgbldr.BuildStatus_done_failure {
			return "", xerrors.Errorf("cannot build workspace image: %s", resp.Message)
		}
	}

	return reslv.Ref, nil
}

// DeleteWorkspace cleans up a workspace started during an integration test
func DeleteWorkspace(it *Test, instanceID string) {
	err := func() error {
		ctx, cancel := context.WithTimeout(it.ctx, perCallTimeout)
		defer cancel()
		_, err := it.API().WorkspaceManager().StopWorkspace(ctx, &wsmanapi.StopWorkspaceRequest{
			Id: instanceID,
		})

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
