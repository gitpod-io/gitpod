// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/activity"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/google/uuid"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/tools/record"
	"k8s.io/utils/pointer"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	// . "github.com/onsi/ginkgo/extensions/table"
)

var _ = Describe("TimeoutController", func() {
	Context("timeouts", func() {
		var (
			now        = time.Now()
			conf       = newTestConfig()
			r          *TimeoutReconciler
			fakeClient client.Client
		)
		BeforeEach(func() {
			var err error
			// Use a fake client instead of the envtest's k8s client, such that we can add objects
			// with custom CreationTimestamps and check timeout logic.
			fakeClient = fake.NewClientBuilder().WithScheme(k8sClient.Scheme()).Build()
			r, err = NewTimeoutReconciler(fakeClient, record.NewFakeRecorder(100), conf, &activity.WorkspaceActivity{}, &fakeMaintenance{enabled: false})
			Expect(err).ToNot(HaveOccurred())
		})

		type testCase struct {
			phase             workspacev1.WorkspacePhase
			lastActivityAgo   *time.Duration
			age               time.Duration
			customTimeout     *time.Duration
			update            func(ws *workspacev1.Workspace)
			updateStatus      func(ws *workspacev1.Workspace)
			controllerRestart time.Time
			expectTimeout     bool
		}
		DescribeTable("workspace timeouts",
			func(tc testCase) {
				By("creating a workspace")
				ws := newWorkspace(uuid.NewString(), "default")
				ws.CreationTimestamp = metav1.NewTime(now.Add(-tc.age))
				Expect(fakeClient.Create(ctx, ws)).To(Succeed())

				if tc.lastActivityAgo != nil {
					r.activity.Store(ws.Name, now.Add(-*tc.lastActivityAgo))
				}

				updateObjWithRetries(fakeClient, ws, false, func(ws *workspacev1.Workspace) {
					if tc.customTimeout != nil {
						ws.Spec.Timeout.Time = &metav1.Duration{Duration: *tc.customTimeout}
					}
					if tc.update != nil {
						tc.update(ws)
					}
				})
				updateObjWithRetries(fakeClient, ws, true, func(ws *workspacev1.Workspace) {
					ws.Status.Phase = tc.phase
					if tc.updateStatus != nil {
						tc.updateStatus(ws)
					}
				})

				// Set controller (re)start time.
				if tc.controllerRestart.IsZero() {
					// Bit arbitrary, but default to the controller running for ~2 days.
					r.ctrlStartTime = now.Add(-48 * time.Hour)

				} else {
					r.ctrlStartTime = tc.controllerRestart
				}

				// Run the timeout controller for this workspace.
				By("running the TimeoutController reconcile()")
				_, err := r.Reconcile(ctx, reconcile.Request{NamespacedName: types.NamespacedName{Name: ws.Name, Namespace: ws.Namespace}})
				Expect(err).ToNot(HaveOccurred())

				if tc.expectTimeout {
					expectTimeout(fakeClient, ws)
				} else {
					expectNoTimeout(fakeClient, ws)
				}
			},
			Entry("should timeout creating workspace", testCase{
				phase:         workspacev1.WorkspacePhaseCreating,
				age:           10 * time.Hour,
				expectTimeout: true,
			}),
			Entry("shouldn't timeout active workspace", testCase{
				phase:           workspacev1.WorkspacePhaseRunning,
				lastActivityAgo: pointer.Duration(1 * time.Minute),
				age:             10 * time.Hour,
				expectTimeout:   false,
			}),
			Entry("should timeout inactive workspace", testCase{
				phase:           workspacev1.WorkspacePhaseRunning,
				lastActivityAgo: pointer.Duration(2 * time.Hour),
				age:             10 * time.Hour,
				expectTimeout:   true,
			}),
			Entry("should timeout inactive workspace with custom timeout", testCase{
				phase: workspacev1.WorkspacePhaseRunning,
				// Use a lastActivity that would not trigger the default timeout, but does trigger the custom timeout.
				lastActivityAgo: pointer.Duration(time.Duration(conf.Timeouts.RegularWorkspace / 2)),
				customTimeout:   pointer.Duration(time.Duration(conf.Timeouts.RegularWorkspace / 3)),
				age:             10 * time.Hour,
				expectTimeout:   true,
			}),
			Entry("should timeout closed workspace", testCase{
				phase: workspacev1.WorkspacePhaseRunning,
				updateStatus: func(ws *workspacev1.Workspace) {
					ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
						Type:               string(workspacev1.WorkspaceConditionClosed),
						LastTransitionTime: metav1.Now(),
						Status:             metav1.ConditionTrue,
					})
				},
				age:             5 * time.Hour,
				lastActivityAgo: pointer.Duration(10 * time.Minute),
				expectTimeout:   true,
			}),
			Entry("should timeout headless workspace", testCase{
				phase: workspacev1.WorkspacePhaseRunning,
				update: func(ws *workspacev1.Workspace) {
					ws.Spec.Type = workspacev1.WorkspaceTypePrebuild
				},
				age:             2 * time.Hour,
				lastActivityAgo: nil,
				expectTimeout:   true,
			}),
			Entry("should timeout workspace over max lifetime", testCase{
				phase:           workspacev1.WorkspacePhaseRunning,
				age:             50 * time.Hour,
				lastActivityAgo: pointer.Duration(1 * time.Minute),
				expectTimeout:   true,
			}),
			Entry("shouldn't timeout after controller restart", testCase{
				phase: workspacev1.WorkspacePhaseRunning,
				updateStatus: func(ws *workspacev1.Workspace) {
					// Add FirstUserActivity condition from 5 hours ago.
					// From this condition the controller should deduce that the workspace
					// has had user activity, but since lastActivity is nil, it's been cleared on
					// a restart. The controller therefore should not timeout the workspace and
					// wait for new user activity. Or timeout once user activity doesn't come
					// eventually after the controller restart.
					ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
						Type:               string(workspacev1.WorkspaceConditionFirstUserActivity),
						Status:             metav1.ConditionTrue,
						LastTransitionTime: metav1.NewTime(now.Add(-5 * time.Hour)),
					})
				},
				age:               5 * time.Hour,
				lastActivityAgo:   nil, // No last activity recorded yet after controller restart.
				controllerRestart: now,
				expectTimeout:     false,
			}),
			Entry("should timeout after controller restart if no FirstUserActivity", testCase{
				phase:             workspacev1.WorkspacePhaseRunning,
				age:               5 * time.Hour,
				lastActivityAgo:   nil, // No last activity recorded yet after controller restart.
				controllerRestart: now,
				expectTimeout:     true,
			}),
			Entry("should timeout eventually with no user activity after controller restart", testCase{
				phase: workspacev1.WorkspacePhaseRunning,
				updateStatus: func(ws *workspacev1.Workspace) {
					ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
						Type:               string(workspacev1.WorkspaceConditionFirstUserActivity),
						Status:             metav1.ConditionTrue,
						LastTransitionTime: metav1.NewTime(now.Add(-5 * time.Hour)),
					})
				},
				age:               5 * time.Hour,
				lastActivityAgo:   nil,
				controllerRestart: now.Add(-2 * time.Hour),
				expectTimeout:     true,
			}),
		)
	})

	Context("reconciliation", func() {
		var r *TimeoutReconciler
		BeforeEach(func() {
			var err error
			r, err = NewTimeoutReconciler(k8sClient, record.NewFakeRecorder(100), newTestConfig(), &activity.WorkspaceActivity{}, &fakeMaintenance{enabled: false})
			Expect(err).ToNot(HaveOccurred())
		})

		It("should requeue timeout reconciles", func() {
			ws := newWorkspace(uuid.NewString(), "default")
			_ = createWorkspaceExpectPod(ws)

			res, err := r.Reconcile(ctx, reconcile.Request{NamespacedName: types.NamespacedName{Name: ws.Name, Namespace: ws.Namespace}})
			Expect(err).To(BeNil())
			Expect(r.reconcileInterval).ToNot(BeZero(), "reconcile interval should be > 0, otherwise events will not requeue")
			Expect(res.RequeueAfter).To(Equal(r.reconcileInterval))
		})

		It("should not requeue when resource is not found", func() {
			res, err := r.Reconcile(ctx, reconcile.Request{NamespacedName: types.NamespacedName{Name: "does-not-exist", Namespace: "default"}})
			Expect(err).ToNot(HaveOccurred(), "not-found errors should not be returned")
			Expect(res.Requeue).To(BeFalse())
			Expect(res.RequeueAfter).To(BeZero())
		})

		It("should return an error other than not-found", func() {
			// Create a different error than "not-found", easiest is to provide an empty name which returns an "invalid request".
			_, err := r.Reconcile(ctx, reconcile.Request{NamespacedName: types.NamespacedName{Name: "", Namespace: "default"}})
			Expect(err).To(HaveOccurred(), "should return error and requeue")
		})
	})
})

func expectNoTimeout(c client.Client, ws *workspacev1.Workspace) {
	GinkgoHelper()
	By("expecting controller to not timeout workspace")
	Consistently(func(g Gomega) {
		g.Expect(c.Get(ctx, types.NamespacedName{Name: ws.Name, Namespace: ws.Namespace}, ws)).To(Succeed())
		g.Expect(wsk8s.GetCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionTimeout))).To(BeNil())
	}, duration, interval).Should(Succeed())
}

func expectTimeout(c client.Client, ws *workspacev1.Workspace) {
	GinkgoHelper()
	By("expecting controller to timeout workspace")
	Eventually(func(g Gomega) {
		g.Expect(c.Get(ctx, types.NamespacedName{Name: ws.Name, Namespace: ws.Namespace}, ws)).To(Succeed())
		cond := wsk8s.GetCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionTimeout))
		g.Expect(cond).ToNot(BeNil())
		g.Expect(cond.Status).To(Equal(metav1.ConditionTrue))
	}, timeout, interval).Should(Succeed())
}
