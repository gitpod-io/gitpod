// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scaler

import (
	"context"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp"
	"github.com/sirupsen/logrus"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	wsmock "github.com/gitpod-io/gitpod/ws-manager/api/mock"
)

func TestWorkspaceManagerPrescaleDriverRenewal(t *testing.T) {
	tests := []struct {
		Name              string
		Workspaces        []*api.WorkspaceStatus
		RenewalPercentage int
		ExpectedDeletions []string
	}{
		{
			Name: "no ghosts",
			Workspaces: []*api.WorkspaceStatus{
				{Id: "w1", Metadata: &api.WorkspaceMetadata{StartedAt: timestamppb.Now()}, Phase: api.WorkspacePhase_RUNNING, Spec: &api.WorkspaceSpec{Type: api.WorkspaceType_REGULAR}},
			},
			RenewalPercentage: 100,
		},
		{
			Name: "one ghost",
			Workspaces: []*api.WorkspaceStatus{
				ghostWorkspace("g1"),
			},
			RenewalPercentage: 100,
			ExpectedDeletions: []string{"g1"},
		},
		{
			Name: "mixed ghost regular",
			Workspaces: []*api.WorkspaceStatus{
				ghostWorkspace("g1"),
				{Id: "w1", Metadata: &api.WorkspaceMetadata{StartedAt: timestamppb.Now()}, Phase: api.WorkspacePhase_RUNNING, Spec: &api.WorkspaceSpec{Type: api.WorkspaceType_REGULAR}},
			},
			RenewalPercentage: 100,
			ExpectedDeletions: []string{"g1"},
		},
		{
			Name: "renew half",
			Workspaces: []*api.WorkspaceStatus{
				ghostWorkspace("g1"),
				ghostWorkspace("g2"),
				{Id: "w1", Metadata: &api.WorkspaceMetadata{StartedAt: timestamppb.Now()}, Phase: api.WorkspacePhase_RUNNING, Spec: &api.WorkspaceSpec{Type: api.WorkspaceType_REGULAR}},
			},
			RenewalPercentage: 50,
			ExpectedDeletions: []string{"g1"},
		},
	}

	log.Log.Logger.SetLevel(logrus.FatalLevel)
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			statusUp := make(chan struct{}, 100)
			wsman := wsmock.NewMockWorkspaceManagerClient(ctrl)
			wsman.EXPECT().GetWorkspaces(gomock.Any(), gomock.Any()).Do(func(a, b interface{}) { statusUp <- struct{}{} }).Return(&api.GetWorkspacesResponse{
				Status: test.Workspaces,
			}, nil)
			wsman.EXPECT().Subscribe(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, _ interface{}) (api.WorkspaceManager_SubscribeClient, error) {
				sub := wsmock.NewMockWorkspaceManager_SubscribeClient(ctrl)
				sub.EXPECT().Recv().Do(func() { <-ctx.Done() })
				return sub, nil
			}).AnyTimes()

			delchan := make(chan string)
			wsman.EXPECT().StopWorkspace(gomock.Any(), gomock.Any()).Do(func(ctx context.Context, req *api.StopWorkspaceRequest) (*api.StopWorkspaceResponse, error) {
				delchan <- req.Id
				return &api.StopWorkspaceResponse{}, nil
			}).AnyTimes()

			renewalTicker := make(chan time.Time)
			defer close(renewalTicker)
			deadTicker := make(chan time.Time)
			defer close(deadTicker)
			faketime := multiFakeTime{
				ProvideTicker: func(d time.Duration) (<-chan time.Time, func()) {
					if d == 42*time.Minute {
						return renewalTicker, func() {}
					}
					return deadTicker, func() {}
				},
				ProvideNow: time.Now,
			}

			var (
				stopChan   = make(chan struct{})
				controller = &testController{
					StatusUpdate: make(chan WorkspaceCount),
					Res:          make(chan int),
				}
			)

			var config WorkspaceManagerPrescaleDriverConfig
			config.Renewal.Percentage = test.RenewalPercentage
			config.Renewal.Interval = util.Duration(42 * time.Minute)
			driver := &WorkspaceManagerPrescaleDriver{
				Config:     config,
				conn:       nil,
				stop:       stopChan,
				Client:     wsman,
				Controller: controller,
				time:       faketime,
			}
			go driver.Run()
			defer driver.Stop()

			<-statusUp
			count := <-controller.StatusUpdate
			// At this point the initial workspace status has propagated through driver.
			// We know this because our test controller has seen a status update.

			// Let's trigger the renewal
			renewalTicker <- time.Now()

			var deletions []string
			for range test.ExpectedDeletions {
				deletions = append(deletions, <-delchan)
			}
			if diff := cmp.Diff(test.ExpectedDeletions, deletions); diff != "" {
				t.Errorf("unexpected deletions (-want +got):\n%s", diff)
			}

			// When we can write to the controller's result channel again, the drivers main loop
			// is unblocked, hence the renewal is done.
			controller.Res <- count.Ghost
		})
	}
}

func ghostWorkspace(name string) *api.WorkspaceStatus {
	return &api.WorkspaceStatus{
		Id: name,
		Metadata: &api.WorkspaceMetadata{
			StartedAt: timestamppb.Now(),
		},
		Phase: api.WorkspacePhase_RUNNING,
		Spec: &api.WorkspaceSpec{
			Type: api.WorkspaceType_GHOST,
		},
	}
}

func TestWorkspaceManagerPrescaleDriverControl(t *testing.T) {
	tests := []struct {
		Name               string
		Workspaces         []*api.WorkspaceStatus
		Setpoint           int
		MaxGhostWorkspaces int
		ExpectedStarts     int
		ExpectedStops      int
	}{
		{
			Name:               "start 10",
			MaxGhostWorkspaces: 10,
			Setpoint:           10,
			ExpectedStarts:     10,
		},
		{
			Name:               "MaxGhostWorkspaces 5, start 10",
			MaxGhostWorkspaces: 5,
			Setpoint:           10,
			ExpectedStarts:     5,
		},
		{
			Name: "stop 5",
			Workspaces: []*api.WorkspaceStatus{
				ghostWorkspace("g1"),
				ghostWorkspace("g2"),
				ghostWorkspace("g3"),
				ghostWorkspace("g4"),
				ghostWorkspace("g5"),
				ghostWorkspace("g6"),
				ghostWorkspace("g7"),
				ghostWorkspace("g8"),
				ghostWorkspace("g9"),
				ghostWorkspace("g10"),
			},
			MaxGhostWorkspaces: 10,
			Setpoint:           5,
			ExpectedStops:      5,
		},
	}

	log.Log.Logger.SetLevel(logrus.FatalLevel)
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			statusUp := make(chan struct{}, 100)
			wsman := wsmock.NewMockWorkspaceManagerClient(ctrl)
			wsman.EXPECT().GetWorkspaces(gomock.Any(), gomock.Any()).Do(func(a, b interface{}) { statusUp <- struct{}{} }).Return(&api.GetWorkspacesResponse{
				Status: test.Workspaces,
			}, nil)
			wsman.EXPECT().Subscribe(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, _ interface{}) (api.WorkspaceManager_SubscribeClient, error) {
				sub := wsmock.NewMockWorkspaceManager_SubscribeClient(ctrl)
				sub.EXPECT().Recv().Do(func() { <-ctx.Done() })
				return sub, nil
			}).AnyTimes()

			var starts int
			wsman.EXPECT().StartWorkspace(gomock.Any(), gomock.Any()).Do(func(ctx context.Context, req *api.StartWorkspaceRequest) (*api.StartWorkspaceResponse, error) {
				starts++
				return &api.StartWorkspaceResponse{}, nil
			}).AnyTimes()

			var stops int
			wsman.EXPECT().StopWorkspace(gomock.Any(), gomock.Any()).Do(func(ctx context.Context, req *api.StopWorkspaceRequest) (*api.StopWorkspaceResponse, error) {
				stops++
				return &api.StopWorkspaceResponse{}, nil
			}).AnyTimes()

			scheduleTicker := make(chan time.Time)
			defer close(scheduleTicker)
			deadTicker := make(chan time.Time)
			defer close(deadTicker)
			faketime := multiFakeTime{
				ProvideTicker: func(d time.Duration) (<-chan time.Time, func()) {
					if d == 42*time.Minute {
						return scheduleTicker, func() {}
					}
					return deadTicker, func() {}
				},
				ProvideNow: time.Now,
			}

			var (
				stopChan   = make(chan struct{})
				controller = &testController{
					StatusUpdate: make(chan WorkspaceCount),
					Res:          make(chan int),
				}
			)

			var config WorkspaceManagerPrescaleDriverConfig
			config.MaxGhostWorkspaces = test.MaxGhostWorkspaces
			config.SchedulerInterval = util.Duration(42 * time.Minute)
			driver := &WorkspaceManagerPrescaleDriver{
				Config:     config,
				conn:       nil,
				stop:       stopChan,
				Client:     wsman,
				Controller: controller,
				time:       faketime,
			}
			go driver.Run()
			defer driver.Stop()

			<-statusUp
			<-controller.StatusUpdate
			// At this point the initial workspace status has propagated through driver.
			// We know this because our test controller has seen a status update.

			// Emit a new setpoint
			controller.Res <- test.Setpoint

			// Let's trigger the scheduling
			scheduleTicker <- time.Now()

			// If we can write a new setpoint the scheduling must be done
			controller.Res <- test.Setpoint

			if diff := cmp.Diff(test.ExpectedStarts, starts); diff != "" {
				t.Errorf("unexpected starts (-want +got):\n%s", diff)
			}
			if diff := cmp.Diff(test.ExpectedStops, stops); diff != "" {
				t.Errorf("unexpected stops (-want +got):\n%s", diff)
			}
		})
	}
}

type multiFakeTime struct {
	ProvideTicker func(d time.Duration) (<-chan time.Time, func())
	ProvideNow    func() time.Time
}

func (t multiFakeTime) NewTicker(d time.Duration) (<-chan time.Time, func()) {
	return t.ProvideTicker(d)
}

func (t multiFakeTime) Now() time.Time {
	return t.ProvideNow()
}

type testController struct {
	StatusUpdate chan WorkspaceCount
	Res          chan int
}

func (c *testController) Control(ctx context.Context, workspaceCount <-chan WorkspaceCount) (ghostCount <-chan int) {
	go func() {
		select {
		case <-ctx.Done():
			return
		case cnt := <-workspaceCount:
			c.StatusUpdate <- cnt
		}
	}()
	return c.Res
}
