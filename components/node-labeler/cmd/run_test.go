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
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"

	"github.com/gitpod-io/gitpod/common-go/util"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
)

const (
	timeout            = time.Second * 10
	duration           = time.Second * 2
	interval           = time.Millisecond * 250
	workspaceNamespace = "default"
	secretsNamespace   = "workspace-secrets"
)

var (
	k8sClient         client.Client
	testEnv           *envtest.Environment
	mock_ctrl         *gomock.Controller
	ctx               context.Context
	cancel            context.CancelFunc
	nodeScaledownCtrl *NodeScaledownAnnotationController
	NodeName          = "cool-ws-node"
)

func TestAPIs(t *testing.T) {
	mock_ctrl = gomock.NewController(t)
	RegisterFailHandler(Fail)
	RunSpecs(t, "Controller Suite")
}

var _ = Describe("NodeScaledownAnnotationController", func() {
	It("should remove scale-down-disabled when last workspace is removed", func() {
		ws1 := newWorkspace(uuid.NewString(), workspaceNamespace, NodeName, workspacev1.WorkspacePhaseRunning)
		ws2 := newWorkspace(uuid.NewString(), workspaceNamespace, NodeName, workspacev1.WorkspacePhaseRunning)
		ws1.Status.Runtime = nil
		ws2.Status.Runtime = nil
		createWorkspace(ws1)
		createWorkspace(ws2)

		By("Assigning nodes to workspaces")
		updateObjWithRetries(k8sClient, ws1, true, func(ws *workspacev1.Workspace) {
			ws.Status.Conditions = []metav1.Condition{}
			ws.Status.Runtime = &workspacev1.WorkspaceRuntimeStatus{
				NodeName: NodeName,
			}
		})

		updateObjWithRetries(k8sClient, ws2, true, func(ws *workspacev1.Workspace) {
			ws.Status.Conditions = []metav1.Condition{}
			ws.Status.Runtime = &workspacev1.WorkspaceRuntimeStatus{
				NodeName: NodeName,
			}
		})

		By("Verifying node annotation")
		Eventually(func(g Gomega) {
			var node corev1.Node
			g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: NodeName}, &node)).To(Succeed())
			g.Expect(node.Annotations).To(HaveKeyWithValue("cluster-autoscaler.kubernetes.io/scale-down-disabled", "true"))
		}, timeout, interval).Should(Succeed())

		By("Deleting workspaces")
		Expect(k8sClient.Delete(ctx, ws1)).To(Succeed())
		Expect(k8sClient.Delete(ctx, ws2)).To(Succeed())

		By("Verifying final state")
		Eventually(func(g Gomega) {
			var node corev1.Node
			g.Expect(k8sClient.Get(ctx, types.NamespacedName{Name: NodeName}, &node)).To(Succeed())
			g.Expect(node.Annotations).ToNot(HaveKey("cluster-autoscaler.kubernetes.io/scale-down-disabled"))
		}, timeout, interval).Should(Succeed())
	})
})

var _ = BeforeSuite(func() {
	logf.SetLogger(zap.New(zap.WriteTo(GinkgoWriter), zap.UseDevMode(true)))

	crdPath := filepath.Join("..", "crd")
	if !util.InLeewayBuild() {
		crdPath = filepath.Join("..", "..", "ws-manager-mk2", "config", "crd", "bases")
	}

	By("bootstrapping test environment")
	testEnv = &envtest.Environment{
		ControlPlaneStartTimeout: 1 * time.Minute,
		ControlPlaneStopTimeout:  1 * time.Minute,
		CRDDirectoryPaths:        []string{crdPath},
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

	By("Creating default ws node")
	node := &corev1.Node{
		ObjectMeta: metav1.ObjectMeta{
			Name: NodeName,
		},
	}
	Expect(k8sClient.Create(ctx, node)).To(Succeed())

	err = k8sManager.GetFieldIndexer().IndexField(context.Background(),
		&workspacev1.Workspace{},
		"status.runtime.nodeName",
		func(o client.Object) []string {
			ws := o.(*workspacev1.Workspace)
			if ws.Status.Runtime == nil {
				return nil
			}
			return []string{ws.Status.Runtime.NodeName}
		})
	Expect(err).ToNot(HaveOccurred())

	By("Setting up controllers")
	nodeScaledownCtrl, err = NewNodeScaledownAnnotationController(k8sManager.GetClient())
	Expect(err).NotTo(HaveOccurred())
	Expect(nodeScaledownCtrl.SetupWithManager(k8sManager)).To(Succeed())

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

var _ = AfterSuite(func() {
	if cancel != nil {
		cancel()
	}
	By("tearing down the test environment")
	err := testEnv.Stop()
	Expect(err).NotTo(HaveOccurred())
})

func newWorkspace(name, namespace, nodeName string, phase workspacev1.WorkspacePhase) *workspacev1.Workspace {
	GinkgoHelper()
	initializer := &csapi.WorkspaceInitializer{
		Spec: &csapi.WorkspaceInitializer_Empty{Empty: &csapi.EmptyInitializer{}},
	}
	initializerBytes, err := proto.Marshal(initializer)
	Expect(err).ToNot(HaveOccurred())

	return &workspacev1.Workspace{
		Status: workspacev1.WorkspaceStatus{
			Phase: phase,
			Runtime: &workspacev1.WorkspaceRuntimeStatus{
				NodeName: nodeName,
			},
			Conditions: []metav1.Condition{},
		},
		TypeMeta: metav1.TypeMeta{
			APIVersion: "workspace.gitpod.io/v1",
			Kind:       "Workspace",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
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
