// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package controller

import (
	"fmt"
	"time"

	"github.com/aws/smithy-go/ptr"
	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/golang/mock/gomock"
	"github.com/google/uuid"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"google.golang.org/protobuf/proto"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

const (
	timeout            = time.Second * 20
	duration           = time.Second * 2
	interval           = time.Millisecond * 250
	workspaceNamespace = "default"
)

var _ = Describe("WorkspaceController", func() {
	Context("with regular workspace", func() {
		It("should handle regular content init", func() {
			name := uuid.NewString()

			mockCtrl := gomock.NewController(GinkgoT())
			defer mockCtrl.Finish()
			ops := NewMockWorkspaceOperations(mockCtrl)

			ops.EXPECT().InitWorkspace(gomock.Any(), gomock.Any()).Return("", nil).Times(1)
			workspaceCtrl.operations = ops

			_ = createSecret(fmt.Sprintf("%s-tokens", name), secretsNamespace)
			ws := newWorkspace(name, workspaceNamespace, workspacev1.WorkspacePhaseCreating)
			createWorkspace(ws)
			updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
				ws.Status.Phase = workspacev1.WorkspacePhaseCreating
				ws.Status.Conditions = []metav1.Condition{}
				ws.Status.Runtime = &workspacev1.WorkspaceRuntimeStatus{
					NodeName: NodeName,
				}
			})

			expectConditionEventually(ws, string(workspacev1.WorkspaceConditionContentReady), metav1.ConditionTrue, "InitializationSuccess")
		})

		It("should handle regular content backup", func() {
			name := uuid.NewString()

			mockCtrl := gomock.NewController(GinkgoT())
			defer mockCtrl.Finish()
			ops := NewMockWorkspaceOperations(mockCtrl)

			gitStatus := &csapi.GitStatus{
				Branch:               "main",
				LatestCommit:         "991300e0cf199116685f25561702a145d40ae462",
				UncommitedFiles:      []string{"git", "pod"},
				TotalUncommitedFiles: 2,
				UntrackedFiles:       []string{"kumquat"},
				TotalUntrackedFiles:  1,
				UnpushedCommits:      []string{"df591ed557c9afa8b6bcd1f51809d83d3f48fc43"},
				TotalUnpushedCommits: 1,
			}

			ops.EXPECT().BackupWorkspace(gomock.Any(), gomock.Any()).Return(gitStatus, nil).Times(1)
			ops.EXPECT().DeleteWorkspace(gomock.Any(), gomock.Any())
			workspaceCtrl.operations = ops

			_ = createSecret(fmt.Sprintf("%s-tokens", name), secretsNamespace)
			ws := newWorkspace(name, workspaceNamespace, workspacev1.WorkspacePhaseCreating)
			createWorkspace(ws)
			markContentReady(ws)

			expectConditionEventually(ws, string(workspacev1.WorkspaceConditionBackupComplete), metav1.ConditionTrue, "BackupComplete")
			expectGitStatusEventually(ws, gitStatus)
		})

		It("should report backup failure", func() {
			name := uuid.NewString()

			mockCtrl := gomock.NewController(GinkgoT())
			defer mockCtrl.Finish()
			ops := NewMockWorkspaceOperations(mockCtrl)

			ops.EXPECT().BackupWorkspace(gomock.Any(), gomock.Any()).Return(nil, fmt.Errorf("BOOM!")).Times(1)
			ops.EXPECT().DeleteWorkspace(gomock.Any(), gomock.Any())
			workspaceCtrl.operations = ops

			_ = createSecret(fmt.Sprintf("%s-tokens", name), secretsNamespace)
			ws := newWorkspace(name, workspaceNamespace, workspacev1.WorkspacePhaseCreating)
			createWorkspace(ws)
			markContentReady(ws)

			expectConditionEventually(ws, string(workspacev1.WorkspaceConditionBackupFailure), metav1.ConditionTrue, "BackupFailed")
		})

		It("should report snapshot url on snapshot", func() {
			name := uuid.NewString()

			mockCtrl := gomock.NewController(GinkgoT())
			defer mockCtrl.Finish()
			ops := NewMockWorkspaceOperations(mockCtrl)

			ops.EXPECT().BackupWorkspace(gomock.Any(), gomock.Any()).Return(nil, nil).Times(1)
			ops.EXPECT().SnapshotIDs(gomock.Any(), gomock.Any()).Return("snapshotUrl", "snapshotName", nil)
			ops.EXPECT().DeleteWorkspace(gomock.Any(), gomock.Any()).Return(nil).Times(1)
			workspaceCtrl.operations = ops

			_ = createSecret(fmt.Sprintf("%s-tokens", name), secretsNamespace)
			ws := newWorkspace(name, workspaceNamespace, workspacev1.WorkspacePhaseCreating)
			ws.Spec.Type = workspacev1.WorkspaceTypePrebuild
			createWorkspace(ws)
			markContentReady(ws)

			Eventually(func(g Gomega) {
				g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: ws.Name, Namespace: ws.Namespace}, ws)).To(Succeed())
				g.Expect(ws.Status.Snapshot).ToNot(BeEmpty())
			}, timeout, interval).Should(Succeed())

			expectConditionEventually(ws, string(workspacev1.WorkspaceConditionBackupComplete), metav1.ConditionTrue, "BackupComplete")
		})

	})
})

func newWorkspace(name, namespace string, phase workspacev1.WorkspacePhase) *workspacev1.Workspace {
	GinkgoHelper()
	initializer := &csapi.WorkspaceInitializer{
		Spec: &csapi.WorkspaceInitializer_Empty{Empty: &csapi.EmptyInitializer{}},
	}
	initializerBytes, err := proto.Marshal(initializer)
	Expect(err).ToNot(HaveOccurred())

	return &workspacev1.Workspace{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "workspace.gitpod.io/v1",
			Kind:       "Workspace",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:       name,
			Namespace:  namespace,
			Finalizers: []string{workspacev1.GitpodFinalizerName},
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
			Initializer: initializerBytes,
			Admission: workspacev1.AdmissionSpec{
				Level: workspacev1.AdmissionLevelEveryone,
			},
		},
	}
}

func createWorkspace(ws *workspacev1.Workspace) {
	GinkgoHelper()
	By("creating workspace")
	Expect(k8sClient.Create(ctx, ws)).To(Succeed())
}

func createSecret(name, namespace string) *corev1.Secret {
	GinkgoHelper()

	By(fmt.Sprintf("creating secret %s", name))
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		StringData: map[string]string{
			"git": "pod",
		},
	}

	Expect(k8sClient.Create(ctx, secret)).To(Succeed())
	Eventually(func() error {
		return k8sClient.Get(ctx, types.NamespacedName{Name: name, Namespace: namespace}, secret)
	}, timeout, interval).Should(Succeed())

	return secret
}

func updateObjWithRetries[O client.Object](c client.Client, obj O, updateStatus bool, update func(obj O)) {
	GinkgoHelper()
	Eventually(func() error {
		var err error
		if err = c.Get(ctx, types.NamespacedName{Name: obj.GetName(), Namespace: obj.GetNamespace()}, obj); err != nil {
			return err
		}
		// Apply update.
		update(obj)
		if updateStatus {
			err = c.Status().Update(ctx, obj)
		} else {
			err = c.Update(ctx, obj)
		}
		return err
	}, timeout, interval).Should(Succeed())
}

func expectConditionEventually(ws *workspacev1.Workspace, tpe string, status metav1.ConditionStatus, reason string) {
	GinkgoHelper()
	By(fmt.Sprintf("expect workspace condition %s to be %s", tpe, status))
	Eventually(func(g Gomega) {
		g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: ws.Name, Namespace: ws.Namespace}, ws)).To(Succeed())
		c := wsk8s.GetCondition(ws.Status.Conditions, tpe)
		g.Expect(c).ToNot(BeNil(), fmt.Sprintf("expected condition %s to be present", tpe))
		g.Expect(c.Status).To(Equal(status))
		if reason != "" {
			g.Expect(c.Reason).To(Equal(reason))
		}
	}, timeout, interval).Should(Succeed())
}

func expectGitStatusEventually(ws *workspacev1.Workspace, gitStatus *csapi.GitStatus) {
	GinkgoHelper()
	By("expect git status")
	Eventually(func(g Gomega) {
		g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: ws.Name, Namespace: ws.Namespace}, ws)).To(Succeed())
		g.Expect(ws.Status.GitStatus.Branch).To(Equal(gitStatus.Branch))
		g.Expect(ws.Status.GitStatus.LatestCommit).To(Equal(gitStatus.LatestCommit))
		g.Expect(ws.Status.GitStatus.UncommitedFiles).To(Equal(gitStatus.UncommitedFiles))
		g.Expect(ws.Status.GitStatus.TotalUncommitedFiles).To(Equal(gitStatus.TotalUncommitedFiles))
		g.Expect(ws.Status.GitStatus.UntrackedFiles).To(Equal(gitStatus.UntrackedFiles))
		g.Expect(ws.Status.GitStatus.TotalUntrackedFiles).To(Equal(gitStatus.TotalUntrackedFiles))
		g.Expect(ws.Status.GitStatus.UnpushedCommits).To(Equal(gitStatus.UnpushedCommits))
		g.Expect(ws.Status.GitStatus.TotalUnpushedCommits).To(Equal(gitStatus.TotalUnpushedCommits))
	}, timeout, interval).Should(Succeed())
}

func markContentReady(ws *workspacev1.Workspace) {
	GinkgoHelper()
	By("adding content ready condition")
	updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
		ws.Status.Phase = workspacev1.WorkspacePhaseStopping
		ws.Status.Conditions = []metav1.Condition{
			workspacev1.NewWorkspaceConditionContentReady(metav1.ConditionTrue, "InitializationSuccess", ""),
		}
		ws.Status.Runtime = &workspacev1.WorkspaceRuntimeStatus{
			NodeName: NodeName,
		}
	})
}
