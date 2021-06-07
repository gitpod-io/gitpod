// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import (
	"context"

	"github.com/gitpod-io/gitpod/common-go/log"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
)

// all functions in this file deal directly with Kubernetes and make several assumptions
// how workspace pods look like. This code should eventually be moved to ws-manager or
// call one of ws-manager's libraries.

// getWorkspaceOwner retrieves the Gitpod user ID of the workspace owner
func (agent *Smith) getWorkspaceInfo() (owner, workspaceID, instanceID string) {
	// todo(fntlnz): get this from the process
	// they are GITPOD_WORKSPACE_ID, GITPOD_INSTANCE_ID
	// maybe owner needs to be pushed via downard API

	// This is now in those pod labels, move it to the filesystem via downard API is probably a solution
	// owner = pod.Labels[wsk8s.OwnerLabel]
	// workspaceID = pod.Labels[wsk8s.MetaIDLabel]
	// instanceID = pod.Labels[wsk8s.WorkspaceIDLabel]
	return "e7f1c402-cf64-41ed-8f9b-87246fead063", "blue-rodent-dgmnfn9f", "a6e117c2-4290-4ce0-a6df-4602fd28e1a5"
}

// stopWorkspace stops a workspace
func (agent *Smith) stopWorkspace(podname string) error {
	// todo(fntlnz): stop the workspace via the kill system call on the workspace's PID 1
	return nil
}

// stopWorkspaceAndBlockUser stops a workspace and blocks the user (who would have guessed?)
func (agent *Smith) stopWorkspaceAndBlockUser(podname string, ownerID string) error {
	err := agent.stopWorkspace(podname)
	if err != nil {
		log.WithError(err).WithField("owner", ownerID).Warn("error stopping workspace")
	}
	err = agent.blockUser(ownerID)
	return err
}

func (agent *Smith) blockUser(ownerID string) error {
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
