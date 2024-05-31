// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"fmt"

	"github.com/aws/smithy-go/ptr"
	"github.com/google/uuid"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"google.golang.org/protobuf/proto"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/constants"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
)

var _ = Describe("WorkspaceController", func() {
	Context("with regular workspaces", func() {
		It("should handle successful workspace creation and stop request", func() {
			name := uuid.NewString()

			envSecret := createSecret(fmt.Sprintf("%s-env", name), "default")
			tokenSecret := createSecret(fmt.Sprintf("%s-tokens", name), secretsNamespace)

			ws := newWorkspace(name, "default")
			m := collectMetricCounts(wsMetrics, ws)
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

			// Transition Pod to pending, and expect workspace to reach Creating  phase.
			// This should also cause create time metrics to be recorded.
			updateObjWithRetries(k8sClient, pod, true, func(pod *corev1.Pod) {
				pod.Status.Phase = corev1.PodPending
				pod.Status.ContainerStatuses = []corev1.ContainerStatus{{
					State: corev1.ContainerState{
						Waiting: &corev1.ContainerStateWaiting{
							Reason: "ContainerCreating",
						},
					},
					Name: "workspace",
				}}
			})

			expectPhaseEventually(ws, workspacev1.WorkspacePhaseCreating)

			// Transition Pod to running, and expect workspace to reach Running phase.
			// This should also cause e.g. startup time metrics to be recorded.
			updateObjWithRetries(k8sClient, pod, true, func(pod *corev1.Pod) {
				pod.Status.Phase = corev1.PodRunning
				pod.Status.ContainerStatuses = []corev1.ContainerStatus{{
					Name:  "workspace",
					Ready: true,
				}}
			})

			updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
				ws.Status.SetCondition(workspacev1.NewWorkspaceConditionContentReady(metav1.ConditionTrue, workspacev1.ReasonInitializationSuccess, ""))
			})

			expectPhaseEventually(ws, workspacev1.WorkspacePhaseRunning)
			expectSecretCleanup(envSecret)
			expectSecretCleanup(tokenSecret)

			markReady(ws)

			requestStop(ws)

			expectFinalizerAndMarkBackupCompleted(ws, pod)

			expectWorkspaceCleanup(ws, pod)

			By("checking pod doesn't get recreated by controller")
			Consistently(func() error {
				return checkNotFound(pod)
			}, duration, interval).Should(Succeed(), "pod came back")

			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				starts:         1,
				creatingCounts: 1,
				restores:       1,
				stops:          map[StopReason]int{StopReasonRegular: 1},
				backups:        1,
			})
		})

		It("should handle content init failure", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			m := collectMetricCounts(wsMetrics, ws)
			pod := createWorkspaceExpectPod(ws)

			By("adding ws init failure condition")
			updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
				ws.Status.SetCondition(workspacev1.NewWorkspaceConditionContentReady(metav1.ConditionFalse, workspacev1.ReasonInitializationFailure, "some failure"))
			})

			// On init failure, expect workspace cleans up without a backup.
			expectWorkspaceCleanup(ws, pod)

			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				startFailures:   1,
				failures:        1,
				restoreFailures: 1,
				stops:           map[StopReason]int{StopReasonStartFailure: 1},
			})
		})

		It("should not take a backup if content init did not happen", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			m := collectMetricCounts(wsMetrics, ws)
			pod := createWorkspaceExpectPod(ws)

			requestStop(ws)

			// No content init, expect cleanup without backup.
			expectWorkspaceCleanup(ws, pod)

			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				startFailures: 0, // No start failure should be recorded, even though the workspace didn't become ready, as it was stopped before it could become ready.
				stops:         map[StopReason]int{StopReasonRegular: 1},
			})
		})

		It("should handle backup failure", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			m := collectMetricCounts(wsMetrics, ws)
			pod := createWorkspaceExpectPod(ws)

			markReady(ws)

			// Stop the workspace.
			requestStop(ws)

			// Indicate the backup failed.
			expectFinalizerAndMarkBackupFailed(ws, pod)

			// Workspace should get cleaned up.
			expectWorkspaceCleanup(ws, pod)

			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				restores:       1,
				backups:        1,
				backupFailures: 1,
				failures:       1,
				stops:          map[StopReason]int{StopReasonFailed: 1},
			})
		})

		It("should handle workspace failure", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			m := collectMetricCounts(wsMetrics, ws)
			pod := createWorkspaceExpectPod(ws)

			markReady(ws)

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

			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				restores:      1,
				startFailures: 0,
				failures:      1,
				stops:         map[StopReason]int{StopReasonFailed: 1},
				backups:       1,
			})
		})

		It("should clean up timed out workspaces", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			m := collectMetricCounts(wsMetrics, ws)
			pod := createWorkspaceExpectPod(ws)

			markReady(ws)

			By("adding Timeout condition")
			updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
				ws.Status.SetCondition(workspacev1.NewWorkspaceConditionTimeout(""))
			})

			expectFinalizerAndMarkBackupCompleted(ws, pod)

			expectWorkspaceCleanup(ws, pod)

			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				restores: 1,
				stops:    map[StopReason]int{StopReasonTimeout: 1},
				backups:  1,
			})
		})

		It("should handle workspace abort", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			m := collectMetricCounts(wsMetrics, ws)
			pod := createWorkspaceExpectPod(ws)

			markReady(ws)

			// Update Pod with stop and abort conditions.
			updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
				ws.Status.SetCondition(workspacev1.NewWorkspaceConditionAborted(""))
				ws.Status.SetCondition(workspacev1.NewWorkspaceConditionStoppedByRequest(""))
			})

			// Expect cleanup without a backup.
			expectWorkspaceCleanup(ws, pod)

			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				restores: 1,
				stops:    map[StopReason]int{StopReasonAborted: 1},
			})
		})

		It("deleting workspace resource should gracefully clean up", func() {
			name := uuid.NewString()
			ws := newWorkspace(name, "default")

			envSecret := createSecret(fmt.Sprintf("%s-env", name), "default")
			tokenSecret := createSecret(fmt.Sprintf("%s-tokens", name), secretsNamespace)

			m := collectMetricCounts(wsMetrics, ws)
			pod := createWorkspaceExpectPod(ws)

			markReady(ws)

			Expect(k8sClient.Delete(ctx, ws)).To(Succeed())

			expectPhaseEventually(ws, workspacev1.WorkspacePhaseStopping)

			expectFinalizerAndMarkBackupCompleted(ws, pod)

			expectWorkspaceCleanup(ws, pod)

			expectSecretCleanup(envSecret)
			expectSecretCleanup(tokenSecret)

			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				restores: 1,
				stops:    map[StopReason]int{StopReasonRegular: 1},
				backups:  1,
			})
		})

		It("node disappearing should fail with backup failure", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			m := collectMetricCounts(wsMetrics, ws)

			// Simulate pod getting scheduled to a node.
			var node corev1.Node
			node.Name = uuid.NewString()
			Expect(k8sClient.Create(ctx, &node)).To(Succeed())
			// Manually create the workspace pod with the node name.
			// We can't update the pod with the node name, as this operation
			// is only allowed for the scheduler. So as a hack, we manually
			// create the workspace's pod.
			pod := &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:       fmt.Sprintf("ws-%s", ws.Name),
					Namespace:  ws.Namespace,
					Finalizers: []string{workspacev1.GitpodFinalizerName},
					Labels: map[string]string{
						wsk8s.WorkspaceManagedByLabel: constants.ManagedBy,
					},
				},
				Spec: corev1.PodSpec{
					NodeName: node.Name,
					Containers: []corev1.Container{{
						Name:  "workspace",
						Image: "someimage",
					}},
				},
			}

			Expect(k8sClient.Create(ctx, pod)).To(Succeed())
			pod = createWorkspaceExpectPod(ws)
			updateObjWithRetries(k8sClient, pod, false, func(pod *corev1.Pod) {
				Expect(ctrl.SetControllerReference(ws, pod, k8sClient.Scheme())).To(Succeed())
			})
			// Wait until controller has reconciled at least once (by waiting for the runtime status to get updated).
			// This is necessary for the metrics to get recorded correctly. If we don't wait, the first reconciliation
			// might be once the Pod is already in a running state, and hence the metric state might not record e.g. content
			// restore.
			// This is only necessary because we manually created the pod, normally the Pod creation is the controller's
			// first reconciliation which ensures the metrics are recorded from the workspace's initial state.

			Eventually(func(g Gomega) {
				g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: ws.Name, Namespace: ws.Namespace}, ws)).To(Succeed())
				g.Expect(ws.Status.Runtime).ToNot(BeNil())
				g.Expect(ws.Status.Runtime.PodName).To(Equal(pod.Name))
			}, timeout, interval).Should(Succeed())

			markReady(ws)

			// Make node disappear 🪄
			By("deleting node")
			Expect(k8sClient.Delete(ctx, &node)).To(Succeed())

			// Expect workspace to disappear, with a backup failure.
			// NOTE: Can't use expectWorkspaceCleanup() here, as the pod never disappears in envtest due to a nodeName being set.
			// Therefore, we only verify deletion timestamps are set and all finalizers are removed, which in a real cluster
			// would cause the pod and workspace to disappear.
			By("workspace and pod finalizers being removed and deletion timestamps set")
			Eventually(func() error {
				if err := k8sClient.Get(ctx, types.NamespacedName{Name: pod.GetName(), Namespace: pod.GetNamespace()}, pod); err != nil {
					if !errors.IsNotFound(err) {
						return err
					}
				} else {
					if len(pod.ObjectMeta.Finalizers) > 0 {
						return fmt.Errorf("pod still has finalizers: %v", pod.ObjectMeta.Finalizers)
					}
					if pod.DeletionTimestamp == nil {
						return fmt.Errorf("pod deletion timestamp not set")
					}
				}

				if err := k8sClient.Get(ctx, types.NamespacedName{Name: ws.GetName(), Namespace: ws.GetNamespace()}, ws); err != nil {
					if !errors.IsNotFound(err) {
						return err
					}
				} else {
					if ws.Status.Phase != workspacev1.WorkspacePhaseStopped {
						return fmt.Errorf("workspace phase did not reach Stopped, was %s", ws.Status.Phase)
					}
					// Can't check for workspace finalizer removal and deletionTimestamp being set,
					// as this only happens once all pods are gone, and the pod never disappears in this test.
				}
				return nil
			}, timeout, interval).Should(Succeed(), "pod/workspace not cleaned up")

			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				restores:       1,
				backups:        1,
				backupFailures: 1,
				failures:       1,
				stops:          map[StopReason]int{StopReasonFailed: 1},
			})
		})

	})

	Context("with headless workspaces", func() {
		It("should handle headless task failure", func() {
			ws, pod, m := createHeadlessWorkspace(workspacev1.WorkspaceTypePrebuild)

			updateObjWithRetries(k8sClient, pod, true, func(p *corev1.Pod) {
				p.Status.Phase = corev1.PodFailed
				p.Status.ContainerStatuses = []corev1.ContainerStatus{
					{
						Name: "workspace",
						State: corev1.ContainerState{
							Terminated: &corev1.ContainerStateTerminated{
								Message:  headlessTaskFailedPrefix,
								ExitCode: 5,
							},
						},
					},
				}
			})

			expectFinalizerAndMarkBackupCompleted(ws, pod)
			expectWorkspaceCleanup(ws, pod)
			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				restores:       1,
				backups:        1,
				backupFailures: 0,
				failures:       0,
				stops:          map[StopReason]int{StopReasonRegular: 1},
			})
		})

		It("should handle successful prebuild", func() {
			ws, pod, m := createHeadlessWorkspace(workspacev1.WorkspaceTypePrebuild)
			updateObjWithRetries(k8sClient, pod, true, func(p *corev1.Pod) {
				p.Status.Phase = corev1.PodSucceeded
			})

			expectFinalizerAndMarkBackupCompleted(ws, pod)
			expectWorkspaceCleanup(ws, pod)
			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				restores:       1,
				backups:        1,
				backupFailures: 0,
				failures:       0,
				stops:          map[StopReason]int{StopReasonRegular: 1},
			})
		})

		It("should handle failed prebuild", func() {
			ws, pod, m := createHeadlessWorkspace(workspacev1.WorkspaceTypePrebuild)
			updateObjWithRetries(k8sClient, pod, true, func(p *corev1.Pod) {
				p.Status.Phase = corev1.PodFailed
				p.Status.ContainerStatuses = []corev1.ContainerStatus{
					{
						Name: "workspace",
						State: corev1.ContainerState{
							Terminated: &corev1.ContainerStateTerminated{
								Message:  "prebuild failed",
								ExitCode: 5,
							},
						},
					},
				}
			})

			expectFinalizerAndMarkBackupCompleted(ws, pod)
			expectWorkspaceCleanup(ws, pod)
			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				restores:       1,
				backups:        1,
				backupFailures: 0,
				failures:       1,
				stops:          map[StopReason]int{StopReasonFailed: 1},
			})
		})

		It("should handle aborted prebuild", func() {
			ws, pod, m := createHeadlessWorkspace(workspacev1.WorkspaceTypePrebuild)
			// abort workspace
			updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
				ws.Status.SetCondition(workspacev1.NewWorkspaceConditionAborted("StopWorkspaceRequest"))
			})

			requestStop(ws)

			// should not take a backup
			expectWorkspaceCleanup(ws, pod)
			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				restores:       1,
				backups:        0,
				backupFailures: 0,
				failures:       0,
				stops:          map[StopReason]int{StopReasonAborted: 1},
			})
		})

		It("should handle imagebuild", func() {
			ws, pod, m := createHeadlessWorkspace(workspacev1.WorkspaceTypeImageBuild)
			updateObjWithRetries(k8sClient, pod, true, func(p *corev1.Pod) {
				p.Status.Phase = corev1.PodSucceeded
			})

			// should not take a backup
			expectWorkspaceCleanup(ws, pod)
			expectMetricsDelta(m, collectMetricCounts(wsMetrics, ws), metricCounts{
				restores:       1,
				backups:        0,
				backupFailures: 0,
				failures:       0,
				stops:          map[StopReason]int{StopReasonRegular: 1},
			})
		})
	})
})

func createHeadlessWorkspace(typ workspacev1.WorkspaceType) (ws *workspacev1.Workspace, pod *corev1.Pod, m metricCounts) {
	name := uuid.NewString()

	ws = newWorkspace(name, "default")
	ws.Spec.Type = typ
	m = collectMetricCounts(wsMetrics, ws)
	pod = createWorkspaceExpectPod(ws)

	// Expect headless
	Expect(ws.IsHeadless()).To(BeTrue())
	Expect(controllerutil.ContainsFinalizer(pod, workspacev1.GitpodFinalizerName)).To(BeTrue())

	// Expect runtime status also gets reported for headless workspaces.
	expectRuntimeStatus(ws, pod)

	By("controller setting status after creation")
	Eventually(func(g Gomega) {
		g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: ws.Name, Namespace: ws.Namespace}, ws)).To(Succeed())
		g.Expect(ws.Status.OwnerToken).ToNot(BeEmpty())
		g.Expect(ws.Status.URL).ToNot(BeEmpty())
	}, timeout, interval).Should(Succeed())

	markReady(ws)
	return
}

func updateObjWithRetries[O client.Object](c client.Client, obj O, updateStatus bool, update func(obj O)) {
	GinkgoHelper()
	Eventually(func() error {
		err := c.Get(ctx, types.NamespacedName{
			Name:      obj.GetName(),
			Namespace: obj.GetNamespace(),
		}, obj)
		if err != nil {
			return err
		}

		// Apply update.
		update(obj)

		if updateStatus {
			return c.Status().Update(ctx, obj)
		}

		return c.Update(ctx, obj)
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
		ws.Status.SetCondition(workspacev1.NewWorkspaceConditionStoppedByRequest(""))
	})
}

func markReady(ws *workspacev1.Workspace) {
	GinkgoHelper()
	By("adding content ready condition")
	updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
		ws.Status.SetCondition(workspacev1.NewWorkspaceConditionContentReady(metav1.ConditionTrue, workspacev1.ReasonInitializationSuccess, ""))
		ws.Status.SetCondition(workspacev1.NewWorkspaceConditionEverReady())
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
		ws.Status.SetCondition(workspacev1.NewWorkspaceConditionBackupComplete())
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

	By("signalling backup failed")
	updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
		ws.Status.SetCondition(workspacev1.NewWorkspaceConditionBackupFailure(""))
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

func expectSecretCleanup(secret *corev1.Secret) {
	GinkgoHelper()

	By("controller deleting secrets")
	Eventually(func() (int, error) {
		var s corev1.Secret
		if err := k8sClient.Get(ctx, types.NamespacedName{Name: secret.GetName(), Namespace: secret.GetNamespace()}, &s); err != nil {
			if errors.IsNotFound(err) {
				return 0, nil
			}
			return 1, err
		}
		return 1, nil

	}, timeout, interval).Should(Equal(0), "environment secret has not been deleted")
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
			Labels: map[string]string{
				wsk8s.WorkspaceManagedByLabel: constants.ManagedBy,
			},
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

type metricCounts struct {
	starts          int
	creatingCounts  int
	startFailures   int
	failures        int
	stops           map[StopReason]int
	backups         int
	backupFailures  int
	restores        int
	restoreFailures int
}

// collectHistCount is a hack to get the value of the histogram's sample count.
// testutil.ToFloat64() does not accept histograms.
func collectHistCount(h prometheus.Histogram) uint64 {
	GinkgoHelper()
	pb := &dto.Metric{}
	Expect(h.Write(pb)).To(Succeed())
	return pb.Histogram.GetSampleCount()
}

var stopReasons = []StopReason{StopReasonFailed, StopReasonStartFailure, StopReasonAborted, StopReasonOutOfSpace, StopReasonTimeout, StopReasonTabClosed, StopReasonRegular}

func collectMetricCounts(wsMetrics *controllerMetrics, ws *workspacev1.Workspace) metricCounts {
	tpe := string(ws.Spec.Type)
	cls := ws.Spec.Class
	startHist := wsMetrics.startupTimeHistVec.WithLabelValues(tpe, cls).(prometheus.Histogram)
	creatingHist := wsMetrics.creatingTimeHistVec.WithLabelValues(tpe, cls).(prometheus.Histogram)
	stopCounts := make(map[StopReason]int)
	for _, reason := range stopReasons {
		stopCounts[reason] = int(testutil.ToFloat64(wsMetrics.totalStopsCounterVec.WithLabelValues(string(reason), tpe, cls)))
	}
	return metricCounts{
		starts:          int(collectHistCount(startHist)),
		creatingCounts:  int(collectHistCount(creatingHist)),
		startFailures:   int(testutil.ToFloat64(wsMetrics.totalStartsFailureCounterVec.WithLabelValues(tpe, cls))),
		failures:        int(testutil.ToFloat64(wsMetrics.totalFailuresCounterVec.WithLabelValues(tpe, cls))),
		stops:           stopCounts,
		backups:         int(testutil.ToFloat64(wsMetrics.totalBackupCounterVec.WithLabelValues(tpe, cls))),
		backupFailures:  int(testutil.ToFloat64(wsMetrics.totalBackupFailureCounterVec.WithLabelValues(tpe, cls))),
		restores:        int(testutil.ToFloat64(wsMetrics.totalRestoreCounterVec.WithLabelValues(tpe, cls))),
		restoreFailures: int(testutil.ToFloat64(wsMetrics.totalRestoreFailureCounterVec.WithLabelValues(tpe, cls))),
	}
}

func expectMetricsDelta(initial metricCounts, cur metricCounts, expectedDelta metricCounts) {
	GinkgoHelper()
	By("checking metrics have been recorded")
	Expect(cur.starts-initial.starts).To(Equal(expectedDelta.starts), "expected metric count delta for starts")
	Expect(cur.creatingCounts-initial.creatingCounts).To(Equal(expectedDelta.creatingCounts), "expected metric count delta for creating count")
	Expect(cur.startFailures-initial.startFailures).To(Equal(expectedDelta.startFailures), "expected metric count delta for startFailures")
	Expect(cur.failures-initial.failures).To(Equal(expectedDelta.failures), "expected metric count delta for failures")
	for _, reason := range stopReasons {
		Expect(cur.stops[reason]-initial.stops[reason]).To(Equal(expectedDelta.stops[reason]), "expected metric count delta for stops with reason %s", reason)
	}
	Expect(cur.backups-initial.backups).To(Equal(expectedDelta.backups), "expected metric count delta for backups")
	Expect(cur.backupFailures-initial.backupFailures).To(Equal(expectedDelta.backupFailures), "expected metric count delta for backupFailures")
	Expect(cur.restores-initial.restores).To(Equal(expectedDelta.restores), "expected metric count delta for restores")
	Expect(cur.restoreFailures-initial.restoreFailures).To(Equal(expectedDelta.restoreFailures), "expected metric count delta for restoreFailures")
}
