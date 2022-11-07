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
	"testing"
	"time"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/gitpod-io/gitpod/common-go/namegen"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	imgbldr "github.com/gitpod-io/gitpod/image-builder/api"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

const (
	gitpodBuiltinUserID             = "builtin-user-workspace-probe-0000000"
	perCallTimeout                  = 5 * time.Minute
	ParallelLunchableWorkspaceLimit = 4
)

var (
	ErrWorkspaceInstanceStopping = fmt.Errorf("workspace instance is stopping")
	ErrWorkspaceInstanceStopped  = fmt.Errorf("workspace instance has stopped")
	parallelLimiter              = make(chan struct{}, ParallelLunchableWorkspaceLimit)
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
	Req         *wsmanapi.StartWorkspaceRequest
	WorkspaceID string
	IdeURL      string
	LastStatus  *wsmanapi.WorkspaceStatus
}

type StopWorkspaceFunc = func(waitForStop bool, api *ComponentAPI) (*wsmanapi.WorkspaceStatus, error)

// LaunchWorkspaceDirectly starts a workspace pod by talking directly to ws-manager.
// Whenever possible prefer this function over LaunchWorkspaceFromContextURL, because
// it has fewer prerequisites.
func LaunchWorkspaceDirectly(t *testing.T, ctx context.Context, api *ComponentAPI, opts ...LaunchWorkspaceDirectlyOpt) (*LaunchWorkspaceDirectlyResult, StopWorkspaceFunc, error) {
	var stopWs StopWorkspaceFunc = nil
	options := launchWorkspaceDirectlyOptions{
		BaseImage: "docker.io/gitpod/workspace-full:latest",
	}
	for _, o := range opts {
		err := o(&options)
		if err != nil {
			return nil, nil, err
		}
	}

	instanceID, err := uuid.NewRandom()
	if err != nil {
		return nil, nil, err

	}
	workspaceID, err := namegen.GenerateWorkspaceID()
	if err != nil {
		return nil, nil, err
	}

	t.Log("obtaining a lock to create a workspace")
	parallelLimiter <- struct{}{}
	defer func() {
		if err != nil && stopWs == nil {
			t.Log("unlock the parallelLimiter because of error during stating the workspace")
			<-parallelLimiter
		}
	}()
	t.Log("got the lock of parallelLimiter")

	var workspaceImage string
	if options.BaseImage != "" {
		for i := 0; i < 3; i++ {
			workspaceImage, err = resolveOrBuildImage(ctx, api, options.BaseImage)
			if st, ok := status.FromError(err); ok && st.Code() == codes.Unavailable {
				api.ClearImageBuilderClientCache()
				time.Sleep(5 * time.Second)
				continue
			} else if err != nil && strings.Contains(err.Error(), "the server is currently unable to handle the request") {
				api.ClearImageBuilderClientCache()
				time.Sleep(5 * time.Second)
				continue
			} else if err != nil && strings.Contains(err.Error(), "apiserver not ready") {
				api.ClearImageBuilderClientCache()
				time.Sleep(5 * time.Second)
				continue
			} else if err != nil {
				time.Sleep(5 * time.Second)
				continue
			}
			break
		}
		if err != nil {
			return nil, nil, err
		}
	}

	waitErr := wait.PollImmediate(5*time.Second, 2*time.Minute, func() (bool, error) {
		workspaceImage, err = resolveOrBuildImage(ctx, api, options.BaseImage)
		if st, ok := status.FromError(err); ok && st.Code() == codes.Unavailable {
			api.ClearImageBuilderClientCache()
			return false, nil
		} else if err != nil && strings.Contains(err.Error(), "the server is currently unable to handle the request") {
			api.ClearImageBuilderClientCache()
			return false, nil
		} else if err != nil && strings.Contains(err.Error(), "apiserver not ready") {
			api.ClearImageBuilderClientCache()
			return false, nil
		} else if err != nil {
			return false, nil
		}
		return true, nil
	})

	if waitErr == wait.ErrWaitTimeout {
		return nil, nil, fmt.Errorf("timeout waiting for resolving the build image: %w", waitErr)
	} else if waitErr != nil {
		return nil, nil, waitErr
	} else if err != nil {
		return nil, nil, err
	} else if workspaceImage == "" {
		err = xerrors.Errorf("cannot start workspaces without a workspace image (required by registry-facade resolver)")
		return nil, nil, err
	}

	ideImage := options.IdeImage
	if ideImage == "" {
		var cfg *ServerIDEConfigPartial
		for i := 0; i < 3; i++ {
			cfg, err = GetServerIDEConfig(api.namespace, api.client)
			if err != nil {
				continue
			}
		}
		if err != nil {
			return nil, nil, xerrors.Errorf("cannot find server IDE config: %w", err)
		}
		ideImage = cfg.IDEOptions.Options.Code.Image
		if ideImage == "" {
			err = xerrors.Errorf("cannot start workspaces without an IDE image (required by registry-facade resolver)")
			return nil, nil, err
		}
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
			WorkspaceImage:     workspaceImage,
			DeprecatedIdeImage: ideImage,
			IdeImage: &wsmanapi.IDEImage{
				WebRef: ideImage,
			},
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
			Envvars: []*wsmanapi.EnvironmentVariable{
				// VSX_REGISTRY_URL is set by server, since we start the workspace directly
				// from ws-manager in these tests we need to set it here ourselves.
				{
					Name:  "VSX_REGISTRY_URL",
					Value: "https://open-vsx.gitpod.io/",
				},
			},
		},
	}
	for _, m := range options.Mods {
		err := m(req)
		if err != nil {
			return nil, nil, err
		}
	}

	t.Log("prepare for a connection with ws-manager")
	wsm, err := api.WorkspaceManager()
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot start workspace manager: %w", err)
	}
	t.Log("established a connection with ws-manager")

	var sresp *wsmanapi.StartWorkspaceResponse
	for i := 0; i < 3; i++ {
		t.Logf("attemp to start up the workspace directly: %s, %s", instanceID, workspaceID)
		sresp, err = wsm.StartWorkspace(ctx, req)
		if err != nil {
			scode := status.Code(err)
			if scode == codes.NotFound || scode == codes.Unavailable {
				t.Log("retry strarting a workspace because cannnot start workspace: %w", err)
				time.Sleep(1 * time.Second)

				api.ClearWorkspaceManagerClientCache()
				wsm, err = api.WorkspaceManager()
				if err != nil {
					return nil, nil, xerrors.Errorf("cannot start workspace manager: %w", err)
				}
				continue
			}
			if strings.Contains(err.Error(), "too many requests") {
				t.Log("hit too many requests so retry after some seconds")
				time.Sleep(30 * time.Second)
				continue
			}
			err = xerrors.Errorf("cannot start workspace: %w", err)
			return nil, nil, err
		}
		break
	}
	t.Log("successfully sent workspace start request")

	stopWs = stopWsF(t, req.Id, req.Metadata.MetaId, api, req.Type == wsmanapi.WorkspaceType_PREBUILD)
	defer func() {
		if err != nil {
			_, _ = stopWs(false, api)
		}
	}()

	t.Log("wait for workspace to be fully up and running")
	lastStatus, err := WaitForWorkspaceStart(t, ctx, req.Id, req.Metadata.MetaId, api, options.WaitForOpts...)
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot wait for workspace start: %w", err)
	}
	t.Log("successful launch of the workspace")

	return &LaunchWorkspaceDirectlyResult{
		Req:         req,
		WorkspaceID: workspaceID,
		IdeURL:      sresp.Url,
		LastStatus:  lastStatus,
	}, stopWs, nil
}

// LaunchWorkspaceFromContextURL force-creates a new workspace using the Gitpod server API,
// and waits for the workspace to start. If any step along the way fails, this function will
// fail the test.
//
// When possible, prefer the less complex LaunchWorkspaceDirectly.
func LaunchWorkspaceFromContextURL(t *testing.T, ctx context.Context, contextURL string, username string, api *ComponentAPI, serverOpts ...GitpodServerOpt) (*protocol.WorkspaceInfo, StopWorkspaceFunc, error) {
	var (
		defaultServerOpts []GitpodServerOpt
		stopWs            StopWorkspaceFunc = nil
		err               error
	)

	if username != "" {
		defaultServerOpts = []GitpodServerOpt{WithGitpodUser(username)}
	}

	parallelLimiter <- struct{}{}
	defer func() {
		if err != nil && stopWs == nil {
			<-parallelLimiter
		}
	}()

	t.Log("prepare for a connection with gitpod server")
	server, err := api.GitpodServer(append(defaultServerOpts, serverOpts...)...)
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot start server: %w", err)
	}
	t.Log("established a connection with gitpod server")

	cctx, ccancel := context.WithTimeout(context.Background(), perCallTimeout)
	defer ccancel()

	var resp *protocol.WorkspaceCreationResult
	for i := 0; i < 3; i++ {
		t.Logf("attemp to create the workspace: %s", contextURL)
		resp, err = server.CreateWorkspace(cctx, &protocol.CreateWorkspaceOptions{
			ContextURL:                         contextURL,
			IgnoreRunningPrebuild:              true,
			IgnoreRunningWorkspaceOnSameCommit: true,
		})
		if err != nil {
			scode := status.Code(err)
			if scode == codes.NotFound || scode == codes.Unavailable {
				t.Log("retry strarting a workspace because cannnot start workspace: %w", err)
				time.Sleep(1 * time.Second)
				api.ClearGitpodServerClientCache()
				server, err = api.GitpodServer(append(defaultServerOpts, serverOpts...)...)
				if err != nil {
					return nil, nil, xerrors.Errorf("cannot start server: %w", err)
				}
				continue
			}
			if strings.Contains(err.Error(), "too many requests") {
				t.Log("hit too many requests so retry after some seconds")
				time.Sleep(30 * time.Second)
				continue
			}
			return nil, nil, xerrors.Errorf("cannot start workspace: %w", err)
		}
		break
	}

	t.Logf("attemp to get the workspace information: %s", resp.CreatedWorkspaceID)
	wi, err := server.GetWorkspace(ctx, resp.CreatedWorkspaceID)
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot get workspace: %w", err)
	}
	if wi.LatestInstance == nil {
		return nil, nil, xerrors.Errorf("CreateWorkspace did not start the workspace")
	}
	t.Logf("got the workspace information: %s", wi.Workspace.ID)

	// GetWorkspace might receive an instance before we seen the first event
	// from ws-manager, in which case IdeURL is not set
	if wi.LatestInstance.IdeURL == "" {
		wi.LatestInstance.IdeURL = resp.WorkspaceURL
	}

	stopWs = stopWsF(t, wi.LatestInstance.ID, resp.CreatedWorkspaceID, api, false)
	defer func() {
		if err != nil {
			_, _ = stopWs(false, api)
		}
	}()

	t.Log("wait for workspace to be fully up and running")
	wsState, err := WaitForWorkspaceStart(ctx, wi.LatestInstance.ID, resp.CreatedWorkspaceID, api)
	if err != nil {
		return nil, nil, xerrors.Errorf("failed to wait for the workspace to start up: %w", err)
	}
	if wi.LatestInstance.IdeURL == "" {
		wi.LatestInstance.IdeURL = wsState.Spec.Url
	}
	t.Log("successful launch of the workspace")

	return wi, stopWs, nil
}

func stopWsF(t *testing.T, instanceID string, workspaceID string, api *ComponentAPI, isPrebuild bool) StopWorkspaceFunc {
	var already bool
	return func(waitForStop bool, api *ComponentAPI) (*wsmanapi.WorkspaceStatus, error) {
		if already {
			t.Logf("already sent stop request: %s", instanceID)
			return nil, nil
		}

		var err error
		defer func() {
			if already {
				return
			} else {
				t.Log("unlock the parallelLimiter")
				<-parallelLimiter
			}
			already = true
		}()

		sctx, scancel := context.WithTimeout(context.Background(), perCallTimeout)
		defer scancel()

		for {
			t.Logf("attemp to delete the workspace: %s", instanceID)
			err := DeleteWorkspace(sctx, api, instanceID)
			if err != nil {
				if st, ok := status.FromError(err); ok && st.Code() == codes.Unavailable {
					api.ClearWorkspaceManagerClientCache()
					t.Logf("got %v when deleting workspace", st)
					time.Sleep(5 * time.Second)
					continue
				}

				return nil, err
			}

			break
		}

		wm, err := api.WorkspaceManager()
		if err != nil {
			return nil, err
		}

		dr, err := wm.DescribeWorkspace(sctx, &wsmanapi.DescribeWorkspaceRequest{
			Id: instanceID,
		})
		if err != nil {
			if s, ok := status.FromError(err); ok && s.Code() == codes.NotFound {
				t.Logf("the workspace is already gone: %v", instanceID)
				return &wsmanapi.WorkspaceStatus{
					Id:    instanceID,
					Phase: wsmanapi.WorkspacePhase_STOPPED,
				}, nil
			}

			return nil, err
		}

		if !waitForStop {
			return dr.Status, nil
		}

		var lastStatus *wsmanapi.WorkspaceStatus
		for {
			t.Logf("waiting for stopping the workspace: %s", instanceID)
			lastStatus, err = WaitForWorkspaceStop(t, sctx, api, instanceID, workspaceID)
			if err != nil {
				if st, ok := status.FromError(err); ok {
					switch st.Code() {
					case codes.Unavailable:
						api.ClearWorkspaceManagerClientCache()
						t.Logf("got %v during waiting for stopping the workspace", st)
						time.Sleep(5 * time.Second)
						continue
					case codes.NotFound:
						t.Logf("the workspace is already gone: %v", instanceID)
						return lastStatus, nil
					}
				}

				return lastStatus, err
			}

			break
		}
		t.Logf("Successfully terminated workspace")

		return lastStatus, nil
	}
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
func WaitForWorkspaceStart(t *testing.T, ctx context.Context, instanceID string, workspaceID string, api *ComponentAPI, opts ...WaitForWorkspaceOpt) (lastStatus *wsmanapi.WorkspaceStatus, err error) {
	var cfg waitForWorkspaceOpts
	for _, o := range opts {
		o(&cfg)
	}

	t.Log("prepare for a connection with ws-manager")
	sub, err := getWsManagerSubClientWithRetry(ctx, api, workspaceID)
	if err != nil {
		return nil, err
	}
	defer func() {
		if sub != nil {
			_ = sub.CloseSend()
		}
	}()
	t.Log("established for a connection with ws-manager")

	done := make(chan *wsmanapi.WorkspaceStatus)
	errStatus := make(chan error)

	go func() {
		var s *wsmanapi.WorkspaceStatus
		defer func() {
			done <- s
			close(done)
		}()
		for {
			resp, err := sub.Recv()
			if err != nil {
				if st, ok := status.FromError(err); ok && st.Code() == codes.Unavailable {
					sub.CloseSend()
					api.ClearWorkspaceManagerClientCache()
					wsman, err := api.WorkspaceManager()
					if err != nil {
						errStatus <- xerrors.Errorf("cannot listen for workspace updates: %w", err)
						return
					}
					sub, err = wsman.Subscribe(ctx, &wsmanapi.SubscribeRequest{})
					if err != nil {
						errStatus <- xerrors.Errorf("cannot listen for workspace updates: %w", err)
						return
					}

					continue
				}
				errStatus <- xerrors.Errorf("workspace update error: %w", err)
				return
			}

			s = resp.GetStatus()
			if s == nil || s.Id != instanceID {
				continue
			}

			t.Logf("status: %s, %s", s.Id, s.Phase)

			if cfg.CanFail {
				if s.Phase == wsmanapi.WorkspacePhase_STOPPING {
					// <-parallelLimiter
					return
				}
				if s.Phase == wsmanapi.WorkspacePhase_STOPPED {
					// <-parallelLimiter
					return
				}
			} else {
				if s.Conditions.Failed != "" {
					errStatus <- xerrors.Errorf("workspace instance %s failed: %s", instanceID, s.Conditions.Failed)
					return
				} else if s.Phase == wsmanapi.WorkspacePhase_STOPPING || s.Phase == wsmanapi.WorkspacePhase_STOPPED {
					errStatus <- xerrors.Errorf("workspace instance %s is %s", instanceID, s.Phase)
					return
				}
			}
			if s.Phase != wsmanapi.WorkspacePhase_RUNNING {
				// we're still starting
				continue
			}

			// all is well, the workspace is running
			t.Logf("confirmed that the worksapce is running: %s, %s", s.Id, s.Phase)
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
				return nil, ErrWorkspaceInstanceStopping
			}
		case wsmanapi.WorkspacePhase_STOPPED:
			if !cfg.CanFail {
				return nil, ErrWorkspaceInstanceStopped
			}
		}
	}

	select {
	case <-ctx.Done():
		return nil, xerrors.Errorf("cannot wait for workspace: %w", ctx.Err())
	case s := <-done:
		return s, nil
	case err := <-errStatus:
		return nil, err
	}
}

// WaitForWorkspaceStop waits until a workspace is stopped. Fails the test if the workspace
// fails or does not stop before the context is canceled.
func WaitForWorkspaceStop(t *testing.T, ctx context.Context, api *ComponentAPI, instanceID string, workspaceID string) (lastStatus *wsmanapi.WorkspaceStatus, err error) {
	wsman, err := api.WorkspaceManager()
	if err != nil {
		return nil, xerrors.Errorf("cannot listen for workspace updates: %w", err)
	}

	_, err = wsman.DescribeWorkspace(ctx, &wsmanapi.DescribeWorkspaceRequest{
		Id: instanceID,
	})
	if err != nil {
		return nil, err
	}

	sub, err := wsman.Subscribe(ctx, &wsmanapi.SubscribeRequest{})
	if err != nil {
		return nil, err
	}
	defer func() {
		if sub != nil {
			_ = sub.CloseSend()
		}
	}()

	done := make(chan *wsmanapi.WorkspaceStatus)
	errCh := make(chan error)
	resetSubscriber := func(subscriber wsmanapi.WorkspaceManager_SubscribeClient, sapi *ComponentAPI) (wsmanapi.WorkspaceManager_SubscribeClient, error) {
		subscriber.CloseSend()
		sapi.ClearWorkspaceManagerClientCache()
		wsman, err := sapi.WorkspaceManager()
		if err != nil {
			return nil, xerrors.Errorf("cannot listen for workspace updates: %w", err)
		}
		new_sub, err := wsman.Subscribe(ctx, &wsmanapi.SubscribeRequest{})
		if err != nil {
			return nil, xerrors.Errorf("cannot listen for workspace updates: %w", err)
		}
		return new_sub, nil
	}

	go func() {
		var wss *wsmanapi.WorkspaceStatus
		defer func() {
			done <- wss
			close(done)
		}()

		for {
			t.Log("check if the status of workspace is in the stopped phase")
			time.Sleep(5 * time.Second)
			resp, err := sub.Recv()
			if err != nil {
				t.Logf("recv err %v", err)
				if s, ok := status.FromError(err); ok && s.Code() == codes.Unavailable {
					sub, err = resetSubscriber(sub, api)
					if err == nil {
						t.Logf("continue because unavailable: %v", err)
						continue
					}
				}
				errCh <- xerrors.Errorf("workspace update error: %q", err)
				return
			}

			if wss = resp.GetStatus(); wss != nil && wss.Id == instanceID {
				t.Logf("status: %s, %s", wss.Id, wss.Phase)
				if wss.Conditions.Failed != "" {
					// TODO(toru): we have to fix https://github.com/gitpod-io/gitpod/issues/12021
					if wss.Conditions.Failed != "The container could not be located when the pod was deleted.  The container used to be Running" && wss.Conditions.Failed != "The container could not be located when the pod was terminated" {
						errCh <- xerrors.Errorf("workspace instance %s failed: %s", instanceID, wss.Conditions.Failed)
					}
					t.Logf("return with failed: %s", wss.Conditions.Failed)
					return
				}
				if wss.Phase == wsmanapi.WorkspacePhase_STOPPED {
					t.Logf("confirm the worksapce is stopped: %s, %s", wss.Id, wss.Phase)
					return
				}
				continue
			}

			return
		}
	}()

	// maybe the workspace has stopped in the meantime and we've missed the update
	desc, _ := wsman.DescribeWorkspace(ctx, &wsmanapi.DescribeWorkspaceRequest{Id: instanceID})
	if desc != nil {
		switch desc.Status.Phase {
		case wsmanapi.WorkspacePhase_STOPPED:
			// ensure theia service is cleaned up
			lastStatus = desc.Status
		}
	}

	select {
	case err := <-errCh:
		return nil, err
	case <-ctx.Done():
		return nil, xerrors.Errorf("cannot wait for workspace: %q", ctx.Err())
	case s := <-done:
		return s, nil
	}
}

// WaitForWorkspace waits until the condition function returns true. Fails the test if the condition does
// not become true before the context is canceled.
func WaitForWorkspace(ctx context.Context, api *ComponentAPI, instanceID string, condition func(status *wsmanapi.WorkspaceStatus) bool) (lastStatus *wsmanapi.WorkspaceStatus, err error) {
	wsman, err := api.WorkspaceManager()
	if err != nil {
		return
	}

	sub, err := wsman.Subscribe(ctx, &wsmanapi.SubscribeRequest{})
	if err != nil {
		return nil, xerrors.Errorf("cannot listen for workspace updates: %q", err)
	}

	done := make(chan *wsmanapi.WorkspaceStatus, 1)
	errCh := make(chan error)

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
				errCh <- xerrors.Errorf("workspace update error: %q", err)
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
	desc, err := wsman.DescribeWorkspace(ctx, &wsmanapi.DescribeWorkspaceRequest{Id: instanceID})
	if err != nil {
		return nil, xerrors.Errorf("cannot get workspace: %q", err)
	}
	if condition(desc.Status) {
		once.Do(func() { close(done) })
		return desc.Status, nil
	}

	select {
	case err := <-errCh:
		return nil, err
	case <-ctx.Done():
		return nil, xerrors.Errorf("cannot wait for workspace: %q", ctx.Err())
	case s := <-done:
		return s, nil
	}
}

func resolveOrBuildImage(ctx context.Context, api *ComponentAPI, baseRef string) (absref string, err error) {
	cl, err := api.ImageBuilder()
	if err != nil {
		return
	}

	reslv, err := cl.ResolveWorkspaceImage(ctx, &imgbldr.ResolveWorkspaceImageRequest{
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

	if reslv.Status == imgbldr.BuildStatus_done_success {
		return reslv.Ref, nil
	}

	bld, err := cl.Build(ctx, &imgbldr.BuildRequest{
		TriggeredBy: "integration-test",
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
func DeleteWorkspace(ctx context.Context, api *ComponentAPI, instanceID string) error {
	wm, err := api.WorkspaceManager()
	if err != nil {
		return err
	}

	_, err = wm.StopWorkspace(ctx, &wsmanapi.StopWorkspaceRequest{
		Id: instanceID,
	})
	if err != nil {
		return err
	}

	if err == nil {
		return nil
	}

	s, ok := status.FromError(err)
	if ok && s.Code() == codes.NotFound {
		return nil
	}

	return err
}
