// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/smithy-go/ptr"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"

	// . "github.com/onsi/ginkgo/extensions/table"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

var _ = Describe("TimeoutController", func() {
	Context("When workspace is active", func() {
		It("Should not time out on controller (re)start", func() {
			const (
				WorkspaceName      = "test-workspace"
				WorkspaceNamespace = "default"

				timeout  = time.Second * 10
				duration = time.Second * 2
				interval = time.Millisecond * 250
			)

			By("creating a status")

			ctx := context.Background()
			workspace := &workspacev1.Workspace{
				TypeMeta: metav1.TypeMeta{
					APIVersion: "workspace.gitpod.io/v1",
					Kind:       "Workspace",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:      WorkspaceName,
					Namespace: WorkspaceNamespace,
				},
				Spec: workspacev1.WorkspaceSpec{
					Ownership: workspacev1.Ownership{
						Owner:       "foobar",
						WorkspaceID: "cool-workspace",
					},
					Type:  workspacev1.WorkspaceTypeRegular,
					Class: "default",
					Image: workspacev1.WorkspaceImages{
						Workspace: workspacev1.WorkspaceImage{
							Ref: ptr.String("alpine:latest"),
						},
						IDE: workspacev1.IDEImages{
							Refs: []string{},
						},
					},
					Ports:       []workspacev1.PortSpec{},
					Initializer: []byte("abc"),
					Admission: workspacev1.AdmissionSpec{
						Level: workspacev1.AdmissionLevelEveryone,
					},
				},
			}
			Expect(k8sClient.Create(ctx, workspace)).Should(Succeed())

			By("creating a pod")
			podLookupKey := types.NamespacedName{Name: "ws-" + WorkspaceName, Namespace: WorkspaceNamespace}
			createdPod := &corev1.Pod{}

			// We'll need to retry getting this newly created CronJob, given that creation may not immediately happen.
			Eventually(func() bool {
				err := k8sClient.Get(ctx, podLookupKey, createdPod)
				return err == nil
			}, timeout, interval).Should(BeTrue())

			By("updating the pod starts value")
			createdWS := &workspacev1.Workspace{}
			Eventually(func() (int, error) {
				err := k8sClient.Get(ctx, types.NamespacedName{Name: WorkspaceName, Namespace: WorkspaceNamespace}, createdWS)
				if err != nil {
					return 0, err
				}

				return createdWS.Status.PodStarts, nil
			}, timeout, interval).Should(Equal(1))

			By("Creating the pod only once")
			// TODO(cw): remove this hell of a hack once we're on PVC and no longer need to rely on concurrent init processes.
			// Here we assume that the controller will have deleted the pod because it failed,
			// and we removed the finalizer.
			createdPod.Finalizers = []string{}
			Expect(k8sClient.Update(ctx, createdPod)).To(Succeed())
			Expect(k8sClient.Delete(ctx, createdPod)).To(Succeed())
			Eventually(func() bool {
				err := k8sClient.Get(ctx, podLookupKey, createdPod)
				if err != nil {
					// TODO(cw): check if this is a not found error
					// We have an error and assume we did not find the pod. This is what we want.
					return true
				}

				fmt.Println(createdPod.ResourceVersion)
				return false
			}, timeout, interval).Should(BeTrue(), "pod did not go away")

			// Now we make sure the pod doesn't come back
			Consistently(func() bool {
				err := k8sClient.Get(ctx, podLookupKey, createdPod)
				if err != nil {
					// TODO(cw): check if this is a not found error
					// We have an error and assume we did not find the pod. This is what we want.
					return true
				}

				fmt.Println(createdPod.ResourceVersion)
				return false
			}, duration, interval).Should(BeTrue(), "pod came back")
		})
	})
})
