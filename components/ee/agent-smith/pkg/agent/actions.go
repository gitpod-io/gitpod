// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package agent

import (
	"context"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"

	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"
	corev1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/retry"
)

// all functions in this file deal directly with Kubernetes and make several assumptions
// how workspace pods look like. This code should eventually be moved to ws-manager or
// call one of ws-manager's libraries.

// stopWorkspace stops a workspace
func (agent *Smith) stopWorkspace(supervisorPID int, instanceID string) error {
	req := &wsmanapi.StopWorkspaceRequest{
		Id: instanceID,
		// Stop workspace without grace period.
		Policy: wsmanapi.StopWorkspacePolicy_IMMEDIATELY,
	}
	_, err := agent.wsman.StopWorkspace(context.Background(), req)
	if err == nil {
		return nil
	}

	log.WithError(err).WithField("instanceID", instanceID).Warn("error stopping workspace through ws-manager, killing supervisor directly")
	return unix.Kill(supervisorPID, unix.SIGKILL)
}

// stopWorkspaceAndBlockUser stops a workspace and blocks the user (who would have guessed?)
func (agent *Smith) stopWorkspaceAndBlockUser(supervisorPID int, ownerID, workspaceID, instanceID string) error {
	err := agent.stopWorkspace(supervisorPID, instanceID)
	if err != nil {
		log.WithError(err).WithField("owner", ownerID).WithField("workspaceID", workspaceID).Warn("error stopping workspace")
	}
	err = agent.blockUser(ownerID, workspaceID)
	return err
}

func (agent *Smith) blockUser(ownerID, workspaceID string) error {
	if agent.GitpodAPI == nil {
		return xerrors.Errorf("not connected to Gitpod API")
	}

	if len(ownerID) == 0 {
		return xerrors.Errorf("cannot block user as user id is empty")
	}

	log.Infof("Blocking user %s - workspace %v", ownerID, workspaceID)

	req := protocol.AdminBlockUserRequest{
		UserID:    ownerID,
		IsBlocked: true,
	}
	return agent.GitpodAPI.AdminBlockUser(context.Background(), &req)
}

func (agent *Smith) limitCPUUse(podname string) error {
	if agent.Kubernetes == nil {
		return xerrors.Errorf("not connected to Kubernetes - cannot limit CPU usage")
	}
	if agent.Config.Enforcement.CPULimitPenalty == "" {
		return xerrors.Errorf("no CPU limit penalty specified - cannot limit CPU usage")
	}

	ctx := context.Background()
	retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		pods := agent.Kubernetes.CoreV1().Pods(agent.Config.KubernetesNamespace)
		pod, err := pods.Get(ctx, podname, corev1.GetOptions{})
		if err != nil {
			return err
		}

		pod.Annotations[wsk8s.WorkspaceCpuMinLimitAnnotation] = agent.Config.Enforcement.CPULimitPenalty
		pod.Annotations[wsk8s.WorkspaceCpuBurstLimitAnnotation] = agent.Config.Enforcement.CPULimitPenalty
		_, err = pods.Update(ctx, pod, corev1.UpdateOptions{})
		if err != nil {
			return err
		}

		return nil
	})

	return nil
}
