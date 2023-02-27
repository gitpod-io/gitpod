// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"k8s.io/client-go/kubernetes/scheme"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/envtest"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"
	"sigs.k8s.io/controller-runtime/pkg/metrics"

	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/activity"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	//+kubebuilder:scaffold:imports
)

// These tests use Ginkgo (BDD-style Go testing framework). Refer to
// http://onsi.github.io/ginkgo/ to learn more about Ginkgo.

const (
	timeout  = time.Second * 20
	duration = time.Second * 2
	interval = time.Millisecond * 250
)

// var cfg *rest.Config
var k8sClient client.Client
var testEnv *envtest.Environment

func TestAPIs(t *testing.T) {
	RegisterFailHandler(Fail)

	RunSpecs(t, "Controller Suite")
}

var (
	ctx        context.Context
	cancel     context.CancelFunc
	wsActivity *activity.WorkspaceActivity
	wsMetrics  *controllerMetrics
)

var _ = BeforeSuite(func() {
	logf.SetLogger(zap.New(zap.WriteTo(GinkgoWriter), zap.UseDevMode(true)))

	By("bootstrapping test environment")
	testEnv = &envtest.Environment{
		ControlPlaneStartTimeout: 1 * time.Minute,
		ControlPlaneStopTimeout:  1 * time.Minute,
		CRDDirectoryPaths:        []string{filepath.Join("..", "config", "crd", "bases")},
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

	/*
		One thing that this autogenerated file is missing, however, is a way to actually start your controller.
		The code above will set up a client for interacting with your custom Kind,
		but will not be able to test your controller behavior.
		If you want to test your custom controller logic, you’ll need to add some familiar-looking manager logic
		to your BeforeSuite() function, so you can register your custom controller to run on this test cluster.
		You may notice that the code below runs your controller with nearly identical logic to your CronJob project’s main.go!
		The only difference is that the manager is started in a separate goroutine so it does not block the cleanup of envtest
		when you’re done running your tests.
		Note that we set up both a "live" k8s client and a separate client from the manager. This is because when making
		assertions in tests, you generally want to assert against the live state of the API server. If you use the client
		from the manager (`k8sManager.GetClient`), you'd end up asserting against the contents of the cache instead, which is
		slower and can introduce flakiness into your tests. We could use the manager's `APIReader` to accomplish the same
		thing, but that would leave us with two clients in our test assertions and setup (one for reading, one for writing),
		and it'd be easy to make mistakes.
		Note that we keep the reconciler running against the manager's cache client, though -- we want our controller to
		behave as it would in production, and we use features of the cache (like indicies) in our controller which aren't
		available when talking directly to the API server.
	*/
	k8sManager, err := ctrl.NewManager(cfg, ctrl.Options{
		Scheme: scheme.Scheme,
	})
	Expect(err).ToNot(HaveOccurred())

	conf := newTestConfig()
	wsReconciler, err := NewWorkspaceReconciler(k8sManager.GetClient(), k8sManager.GetScheme(), &conf, metrics.Registry)
	wsMetrics = wsReconciler.metrics
	Expect(err).ToNot(HaveOccurred())
	Expect(wsReconciler.SetupWithManager(k8sManager)).To(Succeed())

	wsActivity = &activity.WorkspaceActivity{}
	timeoutReconciler, err := NewTimeoutReconciler(k8sManager.GetClient(), conf, wsActivity)
	Expect(err).ToNot(HaveOccurred())
	Expect(timeoutReconciler.SetupWithManager(k8sManager)).To(Succeed())

	ctx, cancel = context.WithCancel(context.Background())

	go func() {
		defer GinkgoRecover()
		err = k8sManager.Start(ctx)
		Expect(err).ToNot(HaveOccurred(), "failed to run manager")
	}()

})

func newTestConfig() config.Configuration {
	return config.Configuration{
		GitpodHostURL:     "gitpod.io",
		HeartbeatInterval: util.Duration(30 * time.Second),
		Namespace:         "default",
		SeccompProfile:    "default.json",
		Timeouts: config.WorkspaceTimeoutConfiguration{
			AfterClose:          util.Duration(1 * time.Minute),
			Initialization:      util.Duration(30 * time.Minute),
			TotalStartup:        util.Duration(45 * time.Minute),
			RegularWorkspace:    util.Duration(60 * time.Minute),
			MaxLifetime:         util.Duration(36 * time.Hour),
			HeadlessWorkspace:   util.Duration(90 * time.Minute),
			Stopping:            util.Duration(60 * time.Minute),
			ContentFinalization: util.Duration(55 * time.Minute),
			Interrupted:         util.Duration(5 * time.Minute),
		},
		WorkspaceClasses: map[string]*config.WorkspaceClass{
			"default": {
				Name: "default",
			},
		},
		WorkspaceURLTemplate: "{{ .ID }}-{{ .Prefix }}-{{ .Host }}",
	}
}

var _ = AfterSuite(func() {
	cancel()
	By("tearing down the test environment")
	err := testEnv.Stop()
	Expect(err).NotTo(HaveOccurred())
})
