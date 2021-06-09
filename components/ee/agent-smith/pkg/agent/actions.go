// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import (
	"context"
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/log"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"golang.org/x/sys/unix"
)

// all functions in this file deal directly with Kubernetes and make several assumptions
// how workspace pods look like. This code should eventually be moved to ws-manager or
// call one of ws-manager's libraries.

// stopWorkspace stops a workspace
func (agent *Smith) stopWorkspace(supervisorPID int) error {
	return unix.Kill(supervisorPID, unix.SIGKILL)
}

// stopWorkspaceAndBlockUser stops a workspace and blocks the user (who would have guessed?)
func (agent *Smith) stopWorkspaceAndBlockUser(supervisorPID int, ownerID string) error {
	err := agent.stopWorkspace(supervisorPID)
	if err != nil {
		log.WithError(err).WithField("owner", ownerID).Warn("error stopping workspace")
	}
	err = agent.blockUser(ownerID)
	return err
}

func (agent *Smith) blockUser(ownerID string) error {
	if agent.GitpodAPI == nil {
		return fmt.Errorf("not connected to Gitpod API")
	}

	req := protocol.AdminBlockUserRequest{
		UserID:    ownerID,
		IsBlocked: true,
	}
	return agent.GitpodAPI.AdminBlockUser(context.Background(), &req)
}

func (agent *Smith) limitCPUUse(podname string) error {
	// todo(fntlnz): limiting CPU usage via editing the cgroup or using nice/renice seems to be the only option here
	return nil
}
