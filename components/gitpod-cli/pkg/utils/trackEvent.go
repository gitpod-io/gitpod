// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package utils

import (
	"context"
	"encoding/json"

	"github.com/gitpod-io/gitpod/common-go/analytics"
	"golang.org/x/xerrors"
)

const (
	Outcome_Success   = "success"
	Outcome_UserErr   = "user_error"
	Outcome_SystemErr = "system_error"
)

const (
	// System
	SystemErrorCode = "system_error"
	UserErrorCode   = "user_error"

	// Rebuild
	RebuildErrorCode_ImageBuildFailed    = "rebuild_image_build_failed"
	RebuildErrorCode_DockerErr           = "rebuild_docker_err"
	RebuildErrorCode_DockerNotFound      = "rebuild_docker_not_found"
	RebuildErrorCode_DockerRunFailed     = "rebuild_docker_run_failed"
	RebuildErrorCode_MalformedGitpodYaml = "rebuild_malformed_gitpod_yaml"
	RebuildErrorCode_MissingGitpodYaml   = "rebuild_missing_gitpod_yaml"
	RebuildErrorCode_NoCustomImage       = "rebuild_no_custom_image"
	RebuildErrorCode_AlreadyInDebug      = "rebuild_already_in_debug"
	RebuildErrorCode_InvaligLogLevel     = "rebuild_invalid_log_level"

	// UserError
	UserErrorCode_NeedUpgradePlan  = "plan_upgrade_required"
	UserErrorCode_InvalidArguments = "invalid_arg"
	UserErrorCode_AlreadyAttached  = "already_attached"
)

type TrackCommandUsageParams struct {
	Command            []string `json:"command,omitempty"`
	Args               int64    `json:"args,omitempty"`
	Flags              []string `json:"flags,omitempty"`
	Duration           int64    `json:"duration,omitempty"`
	ErrorCode          string   `json:"errorCode,omitempty"`
	WorkspaceId        string   `json:"workspaceId,omitempty"`
	InstanceId         string   `json:"instanceId,omitempty"`
	Timestamp          int64    `json:"timestamp,omitempty"`
	ImageBuildDuration int64    `json:"imageBuildDuration,omitempty"`
	Outcome            string   `json:"outcome,omitempty"`
}

func (e *TrackCommandUsageParams) ExportToJson() (string, error) {
	data, err := json.Marshal(e)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

type analyticsEvent struct {
	Data   *TrackCommandUsageParams
	userId string
	w      analytics.Writer
}

func NewAnalyticsEvent(userId string) *analyticsEvent {
	return &analyticsEvent{
		w:      analytics.NewFromEnvironment(),
		userId: userId,
	}
}

func (e *analyticsEvent) Send(ctx context.Context) error {
	defer e.w.Close()

	data := make(map[string]interface{})
	jsonData, err := json.Marshal(e.Data)
	if err != nil {
		return xerrors.Errorf("Could not marshal event data: %w", err)
	}
	err = json.Unmarshal(jsonData, &data)
	if err != nil {
		return xerrors.Errorf("Could not unmarshal event data: %w", err)
	}

	e.w.Track(analytics.TrackMessage{
		Identity:   analytics.Identity{UserID: e.userId},
		Event:      "gp_command",
		Properties: data,
	})
	return nil
}
