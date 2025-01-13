// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/record"
	"k8s.io/kubectl/pkg/scheme"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/envtest"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"
	ctrl_metrics "sigs.k8s.io/controller-runtime/pkg/metrics"

	//+kubebuilder:scaffold:imports

	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
)

const secretsNamespace = "workspace-secrets"

var (
	k8sClient     client.Client
	testEnv       *envtest.Environment
	mock_ctrl     *gomock.Controller
	ctx           context.Context
	cancel        context.CancelFunc
	workspaceCtrl *WorkspaceController
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

	err = workspacev1.AddToScheme(scheme.Scheme)
	Expect(err).NotTo(HaveOccurred())

	//+kubebuilder:scaffold:scheme

	k8sClient, err = client.New(cfg, client.Options{Scheme: scheme.Scheme})
	Expect(err).NotTo(HaveOccurred())
	Expect(k8sClient).NotTo(BeNil())

	k8sManager, err := ctrl.NewManager(cfg, ctrl.Options{
		Scheme: scheme.Scheme,
	})
	Expect(err).ToNot(HaveOccurred())
	ctx, cancel = context.WithCancel(context.Background())

	workspaceCtrl, err = NewWorkspaceController(k8sClient, record.NewFakeRecorder(100), NodeName, secretsNamespace, 5, nil, ctrl_metrics.Registry, nil)
	Expect(err).NotTo(HaveOccurred())

	Expect(workspaceCtrl.SetupWithManager(k8sManager)).To(Succeed())
	_ = createNamespace(secretsNamespace)

	go func() {
		defer GinkgoRecover()
		err = k8sManager.Start(ctx)
		Expect(err).ToNot(HaveOccurred(), "failed to run manager")
	}()
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
