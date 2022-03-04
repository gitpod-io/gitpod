// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import (
	"context"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"

	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"
	corev1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/retry"
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
		return xerrors.Errorf("not connected to Gitpod API")
	}

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

		pod.Annotations[wsk8s.CPULimitAnnotation] = agent.Config.Enforcement.CPULimitPenalty
		_, err = pods.Update(ctx, pod, corev1.UpdateOptions{})
		if err != nil {
			return err
		}

		return nil
	})

	return nil
}
