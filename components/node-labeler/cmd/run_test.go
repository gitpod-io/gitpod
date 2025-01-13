// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/aws/smithy-go/ptr"
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
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/envtest"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"

	logf "sigs.k8s.io/controller-runtime/pkg/log"
)

const (
	timeout            = time.Second * 20
	duration           = time.Second * 2
	interval           = time.Millisecond * 250
	workspaceNamespace = "default"
)

var _ = Describe("WorkspaceCountController", func() {
	It("should set scale-down-disabled when workspace is assigned to node", func() {
		// Create a workspace
		name := uuid.NewString()
		ws := newWorkspace(name, workspaceNamespace, workspacev1.WorkspacePhaseRunning)
		createWorkspace(ws)

		// Update its runtime status with a node
		updateObjWithRetries(k8sClient, ws, true, func(ws *workspacev1.Workspace) {
			ws.Status.Runtime = &workspacev1.WorkspaceRuntimeStatus{
				NodeName: NodeName,
			}
		})

		// Verify node gets annotated
		Eventually(func(g Gomega) {
			var node corev1.Node
			g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: NodeName}, &node)).To(Succeed())
			g.Expect(node.Annotations).To(HaveKeyWithValue("cluster-autoscaler.kubernetes.io/scale-down-disabled", "true"))
		}, timeout, interval).Should(Succeed())
	})

	It("should remove scale-down-disabled when last workspace is removed", func() {
		// Create two workspaces on the same node
		ws1 := newWorkspace(uuid.NewString(), workspaceNamespace, workspacev1.WorkspacePhaseRunning)
		ws2 := newWorkspace(uuid.NewString(), workspaceNamespace, workspacev1.WorkspacePhaseRunning)
		createWorkspace(ws1)
		createWorkspace(ws2)

		// Assign them to the node
		updateObjWithRetries(k8sClient, ws1, true, func(ws *workspacev1.Workspace) {
			ws.Status.Runtime = &workspacev1.WorkspaceRuntimeStatus{
				NodeName: NodeName,
			}
		})
		updateObjWithRetries(k8sClient, ws2, true, func(ws *workspacev1.Workspace) {
			ws.Status.Runtime = &workspacev1.WorkspaceRuntimeStatus{
				NodeName: NodeName,
			}
		})

		// Verify node has annotation
		Eventually(func(g Gomega) {
			var node corev1.Node
			g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: NodeName}, &node)).To(Succeed())
			g.Expect(node.Annotations).To(HaveKeyWithValue("cluster-autoscaler.kubernetes.io/scale-down-disabled", "true"))
		}, timeout, interval).Should(Succeed())

		// Delete first workspace
		Expect(k8sClient.Delete(ctx, ws1)).To(Succeed())

		// Verify annotation still exists (second workspace still there)
		Consistently(func(g Gomega) {
			var node corev1.Node
			g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: NodeName}, &node)).To(Succeed())
			g.Expect(node.Annotations).To(HaveKeyWithValue("cluster-autoscaler.kubernetes.io/scale-down-disabled", "true"))
		}, "2s", "100ms").Should(Succeed())

		// Delete second workspace
		Expect(k8sClient.Delete(ctx, ws2)).To(Succeed())

		// Verify annotation is removed
		Eventually(func(g Gomega) {
			var node corev1.Node
			g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: NodeName}, &node)).To(Succeed())
			g.Expect(node.Annotations).ToNot(HaveKey("cluster-autoscaler.kubernetes.io/scale-down-disabled"))
		}, timeout, interval).Should(Succeed())
	})

	It("should handle workspaces across multiple nodes", func() {
		const SecondNode = "second-node"

		// Create nodes
		node2 := &corev1.Node{
			ObjectMeta: metav1.ObjectMeta{
				Name: SecondNode,
			},
		}
		Expect(k8sClient.Create(ctx, node2)).To(Succeed())

		// Create workspaces
		ws1 := newWorkspace(uuid.NewString(), workspaceNamespace, workspacev1.WorkspacePhaseRunning)
		ws2 := newWorkspace(uuid.NewString(), workspaceNamespace, workspacev1.WorkspacePhaseRunning)
		createWorkspace(ws1)
		createWorkspace(ws2)

		// Assign to different nodes
		updateObjWithRetries(k8sClient, ws1, true, func(ws *workspacev1.Workspace) {
			ws.Status.Runtime = &workspacev1.WorkspaceRuntimeStatus{
				NodeName: NodeName,
			}
		})
		updateObjWithRetries(k8sClient, ws2, true, func(ws *workspacev1.Workspace) {
			ws.Status.Runtime = &workspacev1.WorkspaceRuntimeStatus{
				NodeName: SecondNode,
			}
		})

		// Verify both nodes get annotated
		Eventually(func(g Gomega) {
			var node1, node2 corev1.Node
			g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: NodeName}, &node1)).To(Succeed())
			g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: SecondNode}, &node2)).To(Succeed())
			g.Expect(node1.Annotations).To(HaveKeyWithValue("cluster-autoscaler.kubernetes.io/scale-down-disabled", "true"))
			g.Expect(node2.Annotations).To(HaveKeyWithValue("cluster-autoscaler.kubernetes.io/scale-down-disabled", "true"))
		}, timeout, interval).Should(Succeed())

		// Delete workspace on first node
		Expect(k8sClient.Delete(ctx, ws1)).To(Succeed())

		// Verify first node's annotation is removed but second remains
		Eventually(func(g Gomega) {
			var node1, node2 corev1.Node
			g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: NodeName}, &node1)).To(Succeed())
			g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: SecondNode}, &node2)).To(Succeed())
			g.Expect(node1.Annotations).ToNot(HaveKey("cluster-autoscaler.kubernetes.io/scale-down-disabled"))
			g.Expect(node2.Annotations).To(HaveKeyWithValue("cluster-autoscaler.kubernetes.io/scale-down-disabled", "true"))
		}, timeout, interval).Should(Succeed())
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
		Status: workspacev1.WorkspaceStatus{
			Phase:      phase,
			Conditions: []metav1.Condition{},
		},
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

const secretsNamespace = "workspace-secrets"

var (
	k8sClient     client.Client
	testEnv       *envtest.Environment
	mock_ctrl     *gomock.Controller
	ctx           context.Context
	cancel        context.CancelFunc
	workspaceCtrl *WorkspaceCountController
	NodeName      = "ws-daemon-node"
)

func TestAPIs(t *testing.T) {
	mock_ctrl = gomock.NewController(t)
	RegisterFailHandler(Fail)
	RunSpecs(t, "Controller Suite")
}

var _ = BeforeSuite(func() {
	logf.SetLogger(zap.New(zap.WriteTo(GinkgoWriter), zap.UseDevMode(true)))

	By("bootstrapping test environment")
	testEnv = &envtest.Environment{
		ControlPlaneStartTimeout: 1 * time.Minute,
		ControlPlaneStopTimeout:  1 * time.Minute,
		CRDDirectoryPaths:        []string{filepath.Join("..", "..", "crd")},
		ErrorIfCRDPathMissing:    true,
	}

	cfg, err := testEnv.Start()
	Expect(err).NotTo(HaveOccurred())
	Expect(cfg).NotTo(BeNil())

	err = workspacev1.AddToScheme(clientgoscheme.Scheme)
	Expect(err).NotTo(HaveOccurred())

	//+kubebuilder:scaffold:scheme

	k8sClient, err = client.New(cfg, client.Options{Scheme: clientgoscheme.Scheme})
	Expect(err).NotTo(HaveOccurred())
	Expect(k8sClient).NotTo(BeNil())

	k8sManager, err := ctrl.NewManager(cfg, ctrl.Options{
		Scheme: clientgoscheme.Scheme,
	})
	Expect(err).ToNot(HaveOccurred())
	ctx, cancel = context.WithCancel(context.Background())

	By("Setting up workspace controller")
	workspaceCtrl, err = NewWorkspaceCountController(k8sClient)
	Expect(err).NotTo(HaveOccurred())
	Expect(workspaceCtrl.SetupWithManager(k8sManager)).To(Succeed())

	_ = createNamespace(secretsNamespace)

	By("Starting the manager")
	go func() {
		defer GinkgoRecover()
		err = k8sManager.Start(ctx)
		Expect(err).ToNot(HaveOccurred(), "failed to run manager")
	}()

	By("Waiting for controllers to be ready")
	DeferCleanup(cancel)

	// Wait for controllers to be ready
	Eventually(func() bool {
		return k8sManager.GetCache().WaitForCacheSync(ctx)
	}, time.Second*10, time.Millisecond*100).Should(BeTrue())
})

func createNamespace(name string) *corev1.Namespace {
	GinkgoHelper()

	namespace := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
	}

	Expect(k8sClient.Create(ctx, namespace)).To(Succeed())
	return namespace
}

var _ = AfterSuite(func() {
	if cancel != nil {
		cancel()
	}
	By("tearing down the test environment")
	err := testEnv.Stop()
	Expect(err).NotTo(HaveOccurred())
})
