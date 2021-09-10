// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package service

import (
	"context"
	"fmt"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp"

	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	storagemock "github.com/gitpod-io/gitpod/content-service/pkg/storage/mock"
)

func TestListLogs(t *testing.T) {
	cfg := config.StorageConfig{
		Stage: config.StageProduction,
		Kind:  config.GCloudStorage, // dummy, mocked away
		BackupTrail: struct {
			Enabled   bool "json:\"enabled\""
			MaxLength int  "json:\"maxLength\""
		}{
			Enabled:   false,
			MaxLength: 3,
		},
		BlobQuota: 1073741824, // 1Gi
	}

	OwnerId := "1234"
	WorkspaceId := "amber-baboon-cij4wozf"
	InstanceId := "958aff1c-849a-460f-8af4-5c5b1401a599"
	logFile := func(name string) string {
		return fmt.Sprintf("workspace/%s/instance/%s/logs/%s", WorkspaceId, InstanceId, name)
	}
	tests := []struct {
		Name            string
		Files           []string
		ExpectedTaskIds []string
	}{
		{
			Name: "one instance, three tasks",
			Files: []string{
				logFile("1"),
				logFile("3"),
				logFile("4"),
			},
			ExpectedTaskIds: []string{"1", "3", "4"},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			s := storagemock.NewMockPresignedAccess(ctrl)
			da := storagemock.NewMockDirectAccess(ctrl)
			daFactory := func(cfg *config.StorageConfig) (storage.DirectAccess, error) {
				return da, nil
			}
			svc := HeadlessLogService{
				cfg:       cfg,
				s:         s,
				daFactory: daFactory,
			}

			s.EXPECT().InstanceObject(gomock.Any(), gomock.Any(), gomock.Any()).
				Return("")
			da.EXPECT().Init(gomock.Any(), gomock.Eq(OwnerId), gomock.Eq(WorkspaceId), gomock.Not(gomock.Eq(""))).
				Times(1)
			da.EXPECT().ListObjects(gomock.Any(), gomock.Any()).Return(test.Files, nil)

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			req := &api.ListLogsRequest{
				OwnerId:     OwnerId,
				WorkspaceId: WorkspaceId,
				InstanceId:  InstanceId,
			}
			resp, err := svc.ListLogs(ctx, req)
			if err != nil {
				t.Fatalf("ListLogs err: %v", err)
			}
			if diff := cmp.Diff(test.ExpectedTaskIds, resp.TaskId); diff != "" {
				t.Errorf("unexpected TaskIds (-want +got):\n%s", diff)
			}
		})
	}
}
