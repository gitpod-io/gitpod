// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"fmt"

	"github.com/aws/smithy-go/ptr"
	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/google/uuid"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"google.golang.org/protobuf/proto"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"

	// . "github.com/onsi/ginkgo/extensions/table"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

var _ = Describe("WorkspaceController", func() {
	Context("with regular workspaces", func() {
		It("should handle successful workspace creation and stop request", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			pod := createWorkspaceExpectPod(ws)

			Expect(controllerutil.ContainsFinalizer(pod, workspacev1.GitpodFinalizerName)).To(BeTrue())

			By("controller updating the pod starts value")
			Eventually(func() (int, error) {
				err := k8sClient.Get(ctx, types.NamespacedName{Name: ws.Name, Namespace: ws.Namespace}, ws)
				if err != nil {
					return 0, err
				}
				return ws.Status.PodStarts, nil
			}, timeout, interval).Should(Equal(1))

			// Deployed condition should be added.
			expectConditionEventually(ws, string(workspacev1.WorkspaceConditionDeployed), metav1.ConditionTrue, "")

			// Runtime status should be set.
			expectRuntimeStatus(ws, pod)

			By("controller setting status after creation")
			Eventually(func(g Gomega) {
				g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: ws.Name, Namespace: ws.Namespace}, ws)).To(Succeed())
				g.Expect(ws.Status.OwnerToken).ToNot(BeEmpty())
				g.Expect(ws.Status.URL).ToNot(BeEmpty())
			}, timeout, interval).Should(Succeed())

			// TODO(wv): Once implemented, expect EverReady condition.

			requestStop(ws)

			expectFinalizerAndMarkBackupCompleted(ws, pod)

			expectWorkspaceCleanup(ws, pod)

			By("checking pod doesn't get recreated by controller")
			Consistently(func() error {
				return checkNotFound(pod)
			}, duration, interval).Should(Succeed(), "pod came back")
		})

		It("should handle content init failure", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			pod := createWorkspaceExpectPod(ws)

			By("adding ws init failure condition")
			updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
				ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
					Type:               string(workspacev1.WorkspaceConditionContentReady),
					Status:             metav1.ConditionFalse,
					Message:            "some failure",
					Reason:             "InitializationFailure",
					LastTransitionTime: metav1.Now(),
				})
			})

			// On init failure, expect workspace cleans up without a backup.
			expectWorkspaceCleanup(ws, pod)
		})

		It("should handle backup failure", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			pod := createWorkspaceExpectPod(ws)

			// Stop the workspace.
			requestStop(ws)

			// Indicate the backup failed.
			expectFinalizerAndMarkBackupFailed(ws, pod)

			// Workspace should get cleaned up.
			expectWorkspaceCleanup(ws, pod)
		})

		It("should handle workspace failure", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			pod := createWorkspaceExpectPod(ws)

			// Update Pod with failed exit status.
			updateObjWithRetries(k8sClient, pod, true, func(pod *corev1.Pod) {
				pod.Status.ContainerStatuses = append(pod.Status.ContainerStatuses, corev1.ContainerStatus{
					LastTerminationState: corev1.ContainerState{
						Terminated: &corev1.ContainerStateTerminated{
							ExitCode: 1,
							Message:  "Error",
						},
					},
				})
			})

			// Controller should detect container exit and add Failed condition.
			expectConditionEventually(ws, string(workspacev1.WorkspaceConditionFailed), metav1.ConditionTrue, "")

			expectFinalizerAndMarkBackupCompleted(ws, pod)

			expectWorkspaceCleanup(ws, pod)
		})

		It("should clean up timed out workspaces", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			pod := createWorkspaceExpectPod(ws)

			By("adding Timeout condition")
			updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
				ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
					Type:               string(workspacev1.WorkspaceConditionTimeout),
					Status:             metav1.ConditionTrue,
					LastTransitionTime: metav1.Now(),
				})
			})

			expectFinalizerAndMarkBackupCompleted(ws, pod)

			expectWorkspaceCleanup(ws, pod)
		})

		It("should handle workspace abort", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			pod := createWorkspaceExpectPod(ws)

			// Update Pod with stop and abort conditions.
			updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
				ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
					Type:               string(workspacev1.WorkspaceConditionAborted),
					Status:             metav1.ConditionTrue,
					LastTransitionTime: metav1.Now(),
				})
				ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
					Type:               string(workspacev1.WorkspaceConditionStoppedByRequest),
					Status:             metav1.ConditionTrue,
					LastTransitionTime: metav1.Now(),
				})
			})

			// Expect cleanup without a backup.
			expectWorkspaceCleanup(ws, pod)
		})

		It("deleting workspace resource should gracefully clean up", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			pod := createWorkspaceExpectPod(ws)

			Expect(k8sClient.Delete(ctx, ws)).To(Succeed())

			expectPhaseEventually(ws, workspacev1.WorkspacePhaseStopping)

			expectFinalizerAndMarkBackupCompleted(ws, pod)

			expectWorkspaceCleanup(ws, pod)
		})
	})

	Context("with headless workspaces", func() {
		var (
			ws  *workspacev1.Workspace
			pod *corev1.Pod
		)
		BeforeEach(func() {
			Skip("TODO(wv): Enable once headless workspaces are implemented")
			// TODO(wv): Test both image builds and prebuilds.
			// TODO(wv): Test prebuild archive gets saved.

			ws = newWorkspace(uuid.NewString(), "default")
			ws.Spec.Type = workspacev1.WorkspaceTypePrebuild
			pod = createWorkspaceExpectPod(ws)

			// Expect headless.
			Expect(ws.IsHeadless()).To(BeTrue())

			// Expect runtime status also gets reported for headless workspaces.
			expectRuntimeStatus(ws, pod)
		})

		It("should cleanup on successful exit", func() {
			// Manually update pod phase & delete pod to simulate pod exiting successfully.
			updateObjWithRetries(k8sClient, pod, true, func(p *corev1.Pod) {
				p.Status.Phase = corev1.PodSucceeded
			})
			Expect(k8sClient.Delete(ctx, pod)).To(Succeed())

			// No backup for headless workspace.
			expectWorkspaceCleanup(ws, pod)
		})

		It("should cleanup on failed exit", func() {
			// Manually update pod phase & delete pod to simulate pod exiting with failure.
			updateObjWithRetries(k8sClient, pod, true, func(p *corev1.Pod) {
				p.Status.Phase = corev1.PodFailed
			})
			Expect(k8sClient.Delete(ctx, pod)).To(Succeed())

			// No backup for headless workspace.
			expectWorkspaceCleanup(ws, pod)
		})
	})
})

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

// createWorkspaceExpectPod creates the workspace resource, and expects
// the controller to eventually create the workspace Pod. The created Pod
// is returned.
func createWorkspaceExpectPod(ws *workspacev1.Workspace) *corev1.Pod {
	GinkgoHelper()
	By("creating workspace")
	Expect(k8sClient.Create(ctx, ws)).To(Succeed())

	By("controller creating workspace pod")
	pod := &corev1.Pod{}
	var podPrefix string
	switch ws.Spec.Type {
	case workspacev1.WorkspaceTypeRegular:
		podPrefix = "ws"
	case workspacev1.WorkspaceTypePrebuild:
		podPrefix = "prebuild"
	case workspacev1.WorkspaceTypeImageBuild:
		podPrefix = "imagebuild"
	}
	Eventually(func() error {
		return k8sClient.Get(ctx, types.NamespacedName{Name: fmt.Sprintf("%s-%s", podPrefix, ws.Name), Namespace: ws.Namespace}, pod)
	}, timeout, interval).Should(Succeed())
	return pod
}

func expectPhaseEventually(ws *workspacev1.Workspace, phase workspacev1.WorkspacePhase) {
	GinkgoHelper()
	By(fmt.Sprintf("controller transition workspace phase to %s", phase))
	Eventually(func(g Gomega) {
		g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: ws.Name, Namespace: ws.Namespace}, ws)).To(Succeed())
		g.Expect(ws.Status.Phase).To(Equal(phase))
	}, timeout, interval).Should(Succeed())
}

func expectConditionEventually(ws *workspacev1.Workspace, tpe string, status metav1.ConditionStatus, reason string) {
	GinkgoHelper()
	By(fmt.Sprintf("controller setting workspace condition %s to %s", tpe, status))
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

func expectRuntimeStatus(ws *workspacev1.Workspace, pod *corev1.Pod) {
	GinkgoHelper()
	By("artificially setting the pod's status")
	// Since there are no Pod controllers running in the EnvTest cluster to populate the Pod status,
	// we artificially update the created Pod's status here, and verify later that the workspace
	// controller reconciles this and puts it in the workspace status.
	var (
		hostIP = "1.2.3.4"
		podIP  = "10.0.0.0"
	)
	updateObjWithRetries(k8sClient, pod, true, func(p *corev1.Pod) {
		p.Status.HostIP = hostIP
		p.Status.PodIP = podIP
	})

	By("controller adding pod status to the workspace status")
	Eventually(func(g Gomega) {
		g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: ws.Name, Namespace: ws.Namespace}, ws)).To(Succeed())
		g.Expect(ws.Status.Runtime).ToNot(BeNil())
		g.Expect(ws.Status.Runtime.HostIP).To(Equal(hostIP))
		g.Expect(ws.Status.Runtime.PodIP).To(Equal(podIP))
		g.Expect(ws.Status.Runtime.PodName).To(Equal(pod.Name))
	}, timeout, interval).Should(Succeed())
}

func requestStop(ws *workspacev1.Workspace) {
	GinkgoHelper()
	By("adding stop signal")
	updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
		ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
			Type:               string(workspacev1.WorkspaceConditionStoppedByRequest),
			Status:             metav1.ConditionTrue,
			LastTransitionTime: metav1.Now(),
		})
	})
}

func expectFinalizerAndMarkBackupCompleted(ws *workspacev1.Workspace, pod *corev1.Pod) {
	GinkgoHelper()
	// Checking for the finalizer enforces our expectation that the workspace
	// should be waiting for a backup to be taken.
	By("checking finalizer exists for backup")
	Consistently(func() (bool, error) {
		if err := k8sClient.Get(ctx, types.NamespacedName{Name: pod.GetName(), Namespace: pod.GetNamespace()}, pod); err != nil {
			return false, err
		}
		return controllerutil.ContainsFinalizer(pod, workspacev1.GitpodFinalizerName), nil
	}, duration, interval).Should(BeTrue(), "missing gitpod finalizer on pod, expected one to wait for backup to succeed")

	By("signalling backup completed")
	updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
		ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
			Type:               string(workspacev1.WorkspaceConditionBackupComplete),
			Status:             metav1.ConditionTrue,
			Reason:             "BackupComplete",
			LastTransitionTime: metav1.Now(),
		})
	})
}

func expectFinalizerAndMarkBackupFailed(ws *workspacev1.Workspace, pod *corev1.Pod) {
	GinkgoHelper()
	// Checking for the finalizer enforces our expectation that the workspace
	// should be waiting for a backup to be taken (or fail).
	By("checking finalizer exists for backup")
	Consistently(func() (bool, error) {
		if err := k8sClient.Get(ctx, types.NamespacedName{Name: pod.GetName(), Namespace: pod.GetNamespace()}, pod); err != nil {
			return false, err
		}
		return controllerutil.ContainsFinalizer(pod, workspacev1.GitpodFinalizerName), nil
	}, duration, interval).Should(BeTrue(), "missing gitpod finalizer on pod, expected one to wait for backup to succeed")

	By("signalling backup completed")
	updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
		ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
			Type:               string(workspacev1.WorkspaceConditionBackupFailure),
			Status:             metav1.ConditionTrue,
			Reason:             "BackupFailed",
			LastTransitionTime: metav1.Now(),
		})
	})
}

func expectWorkspaceCleanup(ws *workspacev1.Workspace, pod *corev1.Pod) {
	GinkgoHelper()
	By("controller removing pod finalizers")
	Eventually(func() (int, error) {
		if err := k8sClient.Get(ctx, types.NamespacedName{Name: pod.GetName(), Namespace: pod.GetNamespace()}, pod); err != nil {
			if errors.IsNotFound(err) {
				// Race: finalizers got removed causing pod to get deleted before we could check.
				// This is what we want though.
				return 0, nil
			}
			return 0, err
		}
		return len(pod.ObjectMeta.Finalizers), nil

	}, timeout, interval).Should(Equal(0), "pod finalizers did not go away")

	By("cleaning up the workspace pod")
	Eventually(func() error {
		return checkNotFound(pod)
	}, timeout, interval).Should(Succeed(), "pod did not go away")

	By("controller removing workspace finalizers")
	Eventually(func() (int, error) {
		if err := k8sClient.Get(ctx, types.NamespacedName{Name: ws.GetName(), Namespace: ws.GetNamespace()}, ws); err != nil {
			if errors.IsNotFound(err) {
				// Race: finalizers got removed causing workspace to get deleted before we could check.
				// This is what we want though.
				return 0, nil
			}
			return 0, err
		}
		return len(ws.ObjectMeta.Finalizers), nil

	}, timeout, interval).Should(Equal(0), "workspace finalizers did not go away")

	By("cleaning up the workspace resource")
	Eventually(func(g Gomega) error {
		if err := checkNotFound(ws); err == nil {
			return nil
		}
		g.Expect(ws.Status.Phase).To(Equal(workspacev1.WorkspacePhaseStopped))
		return fmt.Errorf("workspace is Stopped, but hasn't been deleted yet")
	}, timeout, interval).Should(Succeed(), "workspace did not go away")
}

// checkNotFound returns nil if the object does not exist.
// Otherwise, it returns an error.
func checkNotFound(obj client.Object) error {
	err := k8sClient.Get(ctx, types.NamespacedName{Name: obj.GetName(), Namespace: obj.GetNamespace()}, obj)
	if err == nil {
		// Object exists, return as an error.
		return fmt.Errorf("object exists")
	}
	if errors.IsNotFound(err) {
		// Object doesn't exist, this is what we want.
		return nil
	}
	return err
}

func newWorkspace(name, namespace string) *workspacev1.Workspace {
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
