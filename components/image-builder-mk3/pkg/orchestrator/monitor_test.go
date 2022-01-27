// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package orchestrator

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/gitpod-io/gitpod/image-builder/api"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

func TestExtractBuildResponse(t *testing.T) {
	const (
		buildID          = "build-id"
		ref              = "ref"
		baseref          = "base-ref"
		startedAt  int64 = 12345
		url              = "https://some-url.some-domain.com"
		ownerToken       = "super-secret-owner-token"
	)
	tests := []struct {
		Name        string
		Mod         func(*wsmanapi.WorkspaceStatus)
		Expectation func(*api.BuildResponse)
	}{
		{
			Name:        "running",
			Mod:         func(ws *wsmanapi.WorkspaceStatus) {},
			Expectation: func(br *api.BuildResponse) {},
		},
		{
			Name: "done",
			Mod: func(ws *wsmanapi.WorkspaceStatus) {
				ws.Phase = wsmanapi.WorkspacePhase_STOPPING
			},
			Expectation: func(br *api.BuildResponse) {
				br.Status = api.BuildStatus_done_success
				br.Info.Status = br.Status
			},
		},
		{
			Name: "done stopped",
			Mod: func(ws *wsmanapi.WorkspaceStatus) {
				ws.Phase = wsmanapi.WorkspacePhase_STOPPED
			},
			Expectation: func(br *api.BuildResponse) {
				br.Status = api.BuildStatus_done_success
				br.Info.Status = br.Status
			},
		},
		{
			Name: "done task failed",
			Mod: func(ws *wsmanapi.WorkspaceStatus) {
				ws.Phase = wsmanapi.WorkspacePhase_STOPPING
				ws.Conditions.HeadlessTaskFailed = "image build failed"
			},
			Expectation: func(br *api.BuildResponse) {
				br.Status = api.BuildStatus_done_failure
				br.Info.Status = br.Status
				br.Message = "image build failed"
			},
		},
		{
			Name: "done workspace failed",
			Mod: func(ws *wsmanapi.WorkspaceStatus) {
				ws.Phase = wsmanapi.WorkspacePhase_STOPPING
				ws.Conditions.Failed = "image build failed"
			},
			Expectation: func(br *api.BuildResponse) {
				br.Status = api.BuildStatus_done_failure
				br.Info.Status = br.Status
				br.Message = "image build failed"
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			status := &wsmanapi.WorkspaceStatus{
				Id: buildID,
				Metadata: &wsmanapi.WorkspaceMetadata{
					MetaId: buildID,
					Annotations: map[string]string{
						annotationRef:     ref,
						annotationBaseRef: baseref,
					},
					StartedAt: timestamppb.New(time.Unix(startedAt, 0)),
				},
				Conditions: &wsmanapi.WorkspaceConditions{},
				Phase:      wsmanapi.WorkspacePhase_RUNNING,
				Auth: &wsmanapi.WorkspaceAuthentication{
					OwnerToken: ownerToken,
				},
				Spec: &wsmanapi.WorkspaceSpec{
					Url: url,
				},
			}
			test.Mod(status)
			act := extractBuildResponse(status)

			exp := &api.BuildResponse{
				Ref:     ref,
				BaseRef: baseref,
				Status:  api.BuildStatus_running,
				Info: &api.BuildInfo{
					BuildId:   buildID,
					Ref:       ref,
					BaseRef:   baseref,
					Status:    api.BuildStatus_running,
					StartedAt: startedAt,
					LogInfo: &api.LogInfo{
						Url: url,
						Headers: map[string]string{
							"x-gitpod-owner-token": status.Auth.OwnerToken,
						},
					},
				},
			}
			test.Expectation(exp)

			if diff := cmp.Diff(exp, act, cmpopts.IgnoreUnexported(api.BuildResponse{}, api.BuildInfo{}, api.LogInfo{})); diff != "" {
				t.Errorf("extractBuildResponse() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
