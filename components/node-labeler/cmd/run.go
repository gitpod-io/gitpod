// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/bombsimon/logrusr/v2"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/spf13/cobra"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	_ "k8s.io/client-go/plugin/pkg/client/auth"
	"k8s.io/client-go/util/retry"
	"k8s.io/utils/pointer"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	"sigs.k8s.io/controller-runtime/pkg/metrics"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	"sigs.k8s.io/controller-runtime/pkg/webhook"

	"github.com/gitpod-io/gitpod/common-go/log"
)

const (
	registryFacadeLabel = "gitpod.io/registry-facade_ready_ns_%v"
	wsdaemonLabel       = "gitpod.io/ws-daemon_ready_ns_%v"

	registryFacade = "registry-facade"
	wsDaemon       = "ws-daemon"
)

var defaultRequeueTime = time.Second * 10

// serveCmd represents the serve command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts the node labeler",
	Run: func(cmd *cobra.Command, args []string) {
		ctrl.SetLogger(logrusr.New(log.Log))

		mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
			Scheme:                 scheme,
			HealthProbeBindAddress: ":8086",
			Metrics:                metricsserver.Options{BindAddress: "127.0.0.1:9500"},
			Cache: cache.Options{
				DefaultNamespaces: map[string]cache.Config{
					namespace: {},
				},
				// default sync period is 10h.
				// in case node-labeler is restarted and not change happens, we could waste (at least) 20m in a node
				// that never will run workspaces and the additional nodes cluster-autoscaler adds to compensate
				SyncPeriod: pointer.Duration(2 * time.Minute),
			},
			WebhookServer: webhook.NewServer(webhook.Options{
				Port: 9443,
			}),
			LeaderElection:   true,
			LeaderElectionID: "node-labeler.gitpod.io",
		})
		if err != nil {
			log.WithError(err).Fatal("unable to start node-labeler")
		}

		kClient, err := client.New(ctrl.GetConfigOrDie(), client.Options{})
		if err != nil {
			log.WithError(err).Fatal("unable to create client")
		}

		r := &PodReconciler{
			kClient,
		}

		componentPredicate, err := predicate.LabelSelectorPredicate(metav1.LabelSelector{
			MatchExpressions: []metav1.LabelSelectorRequirement{{
				Key:      "component",
				Operator: metav1.LabelSelectorOpIn,
				Values:   []string{"ws-daemon", "registry-facade"},
			}},
		})
		if err != nil {
			log.WithError(err).Fatal("unable to create predicate")
		}

		err = ctrl.NewControllerManagedBy(mgr).
			Named("pod-watcher").
			For(&corev1.Pod{}, builder.WithPredicates(predicate.Or(componentPredicate))).
			WithOptions(controller.Options{MaxConcurrentReconciles: 1}).
			Complete(r)
		if err != nil {
			log.WithError(err).Fatal("unable to bind controller watch event handler")
		}

		wc, err := NewWorkspaceCountController(mgr.GetClient())
		if err != nil {
			log.WithError(err).Fatal("unable to create workspace count controller")
		}
		err = wc.SetupWithManager(mgr)
		if err != nil {
			log.WithError(err).Fatal("unable to bind workspace count controller")
		}

		metrics.Registry.MustRegister(NodeLabelerCounterVec)
		metrics.Registry.MustRegister(NodeLabelerTimeHistVec)

		err = mgr.AddHealthzCheck("healthz", healthz.Ping)
		if err != nil {
			log.WithError(err).Fatal("unable to set up health check")
		}

		err = mgr.AddReadyzCheck("readyz", healthz.Ping)
		if err != nil {
			log.WithError(err).Fatal("unable to set up ready check")
		}

		log.Info("starting node-labeler")
		err = mgr.Start(ctrl.SetupSignalHandler())
		if err != nil {
			log.WithError(err).Fatal("problem running node-labeler")
		}

		log.Info("Received SIGINT - shutting down")
	},
}

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))
	utilruntime.Must(workspacev1.AddToScheme(scheme))

	rootCmd.AddCommand(runCmd)
}

var (
	scheme = runtime.NewScheme()
)

type PodReconciler struct {
	client.Client
}

func (r *PodReconciler) Reconcile(ctx context.Context, req reconcile.Request) (reconcile.Result, error) {
	var pod corev1.Pod
	err := r.Get(ctx, req.NamespacedName, &pod)
	if err != nil {
		if !errors.IsNotFound(err) {
			log.WithError(err).Error("unable to fetch pod")
		}

		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	nodeName := pod.Spec.NodeName
	if nodeName == "" {
		return reconcile.Result{RequeueAfter: defaultRequeueTime}, nil
	}

	var (
		ipAddress     string
		port          string
		component     string
		labelToUpdate string
	)

	switch {
	case strings.HasPrefix(pod.Name, registryFacade):
		component = registryFacade
		labelToUpdate = fmt.Sprintf(registryFacadeLabel, namespace)
		ipAddress = pod.Status.HostIP
		port = strconv.Itoa(registryFacadePort)
	case strings.HasPrefix(pod.Name, wsDaemon):
		component = wsDaemon
		labelToUpdate = fmt.Sprintf(wsdaemonLabel, namespace)
		ipAddress = pod.Status.PodIP
		port = strconv.Itoa(wsdaemonPort)
	default:
		// nothing to do
		return reconcile.Result{}, nil
	}

	if !pod.ObjectMeta.DeletionTimestamp.IsZero() {
		// the pod is being removed.
		// remove the component label from the node
		time.Sleep(1 * time.Second)
		err := updateLabel(labelToUpdate, false, nodeName, r)
		if err != nil {
			// this is a edge case when cluster-autoscaler removes a node
			// (all the running pods will be removed after that)
			if errors.IsNotFound(err) {
				return reconcile.Result{}, nil
			}

			log.WithError(err).Error("removing node label")
			return reconcile.Result{RequeueAfter: defaultRequeueTime}, err
		}

		return reconcile.Result{}, err
	}

	if !IsPodReady(pod) {
		// not ready. Wait until the next update.
		return reconcile.Result{}, nil
	}

	var node corev1.Node
	err = r.Get(ctx, types.NamespacedName{Name: nodeName}, &node)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("obtaining node %s: %w", nodeName, err)
	}

	if labelValue, exists := node.Labels[labelToUpdate]; exists && labelValue == "true" {
		// nothing to do, the label already exists.
		return reconcile.Result{}, nil
	}

	err = checkTCPPortIsReachable(ipAddress, port)
	if err != nil {
		log.WithField("host", ipAddress).WithField("port", port).WithField("pod", pod.Name).WithError(err).Error("checking if TCP port is open")
		return reconcile.Result{RequeueAfter: defaultRequeueTime}, nil
	}

	if component == registryFacade {
		err = checkRegistryFacade(ipAddress, port)
		if err != nil {
			log.WithError(err).Error("checking registry-facade")
			return reconcile.Result{RequeueAfter: defaultRequeueTime}, nil
		}

		time.Sleep(1 * time.Second)
	}

	err = updateLabel(labelToUpdate, true, nodeName, r)
	if err != nil {
		log.WithError(err).Error("updating node label")
		return reconcile.Result{}, fmt.Errorf("trying to add the label: %v", err)
	}

	readyIn := time.Since(pod.Status.StartTime.Time)
	NodeLabelerTimeHistVec.WithLabelValues(component).Observe(readyIn.Seconds())
	NodeLabelerCounterVec.WithLabelValues(component).Inc()

	return reconcile.Result{}, nil
}

type WorkspaceCountController struct {
	client.Client
}

func NewWorkspaceCountController(client client.Client) (*WorkspaceCountController, error) {
	return &WorkspaceCountController{
		Client: client,
	}, nil
}

func (wc *WorkspaceCountController) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		Named("workspace-count").
		For(&workspacev1.Workspace{}).
		WithEventFilter(workspaceFilter()).
		Complete(wc)
}

func workspaceFilter() predicate.Predicate {
	return predicate.Funcs{
		CreateFunc: func(e event.CreateEvent) bool {
			ws := e.Object.(*workspacev1.Workspace)
			return ws.Status.Runtime != nil && ws.Status.Runtime.NodeName != ""
		},
		UpdateFunc: func(e event.UpdateEvent) bool {
			return false
		},
		DeleteFunc: func(e event.DeleteEvent) bool {
			ws := e.Object.(*workspacev1.Workspace)
			return ws.Status.Runtime != nil && ws.Status.Runtime.NodeName != ""
		},
	}
}

func (wc *WorkspaceCountController) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log.WithField("request", req.NamespacedName.String()).Info("WorkspaceCountController reconciling")

	var ws workspacev1.Workspace
	if err := wc.Get(ctx, req.NamespacedName, &ws); err != nil {
		if !errors.IsNotFound(err) {
			log.WithError(err).WithField("workspace", req.NamespacedName).Error("unable to fetch Workspace")
			return ctrl.Result{}, err
		}
		// If workspace not found, do a full reconciliation
		log.WithField("workspace", req.NamespacedName).Info("Workspace not found, reconciling all nodes")
		return wc.reconcileAllNodes(ctx)
	}

	if ws.Status.Runtime != nil && ws.Status.Runtime.NodeName != "" {
		var workspaceList workspacev1.WorkspaceList
		if err := wc.List(ctx, &workspaceList); err != nil {
			log.WithError(err).Error("failed to list workspaces")
			return ctrl.Result{}, err
		}

		count := 0
		nodeName := ws.Status.Runtime.NodeName
		for _, ws := range workspaceList.Items {
			if ws.Status.Runtime != nil &&
				ws.Status.Runtime.NodeName == nodeName &&
				ws.DeletionTimestamp.IsZero() {
				count++
			}
		}

		if err := wc.updateNodeAnnotation(ctx, nodeName, count); err != nil {
			return ctrl.Result{}, err
		}
		log.WithField("node", nodeName).WithField("count", count).Info("updated node annotation")
	}

	return ctrl.Result{}, nil
}

func (wc *WorkspaceCountController) reconcileAllNodes(ctx context.Context) (ctrl.Result, error) {
	var workspaceList workspacev1.WorkspaceList
	if err := wc.List(ctx, &workspaceList); err != nil {
		log.WithError(err).Error("failed to list workspaces")
		return ctrl.Result{}, err
	}

	workspaceCounts := make(map[string]int)
	for _, ws := range workspaceList.Items {
		if ws.Status.Runtime != nil &&
			ws.Status.Runtime.NodeName != "" &&
			ws.DeletionTimestamp.IsZero() {
			workspaceCounts[ws.Status.Runtime.NodeName]++
		}
	}

	var nodes corev1.NodeList
	if err := wc.List(ctx, &nodes); err != nil {
		log.WithError(err).Error("failed to list nodes")
		return ctrl.Result{}, err
	}

	// Update each node's annotation based on its count
	for _, node := range nodes.Items {
		count := workspaceCounts[node.Name]
		if err := wc.updateNodeAnnotation(ctx, node.Name, count); err != nil {
			log.WithError(err).WithField("node", node.Name).Error("failed to update node")
			continue
		}
		log.WithField("node", node.Name).WithField("count", count).Info("updated node annotation")
	}

	return ctrl.Result{}, nil
}

func (wc *WorkspaceCountController) updateNodeAnnotation(ctx context.Context, nodeName string, count int) error {
	return retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		var node corev1.Node
		err := wc.Get(ctx, types.NamespacedName{Name: nodeName}, &node)
		if err != nil {
			return fmt.Errorf("obtaining node %s: %w", nodeName, err)
		}

		if node.Annotations == nil {
			node.Annotations = make(map[string]string)
		}

		if count > 0 {
			node.Annotations["cluster-autoscaler.kubernetes.io/scale-down-disabled"] = "true"
			log.WithField("nodeName", nodeName).Info("disabling scale-down for node")
		} else {
			delete(node.Annotations, "cluster-autoscaler.kubernetes.io/scale-down-disabled")
			log.WithField("nodeName", nodeName).Info("enabling scale-down for node")
		}

		return wc.Update(ctx, &node)
	})
}

func updateLabel(label string, add bool, nodeName string, client client.Client) error {
	return retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var node corev1.Node
		err := client.Get(ctx, types.NamespacedName{Name: nodeName}, &node)
		if err != nil {
			return err
		}

		if add {
			node.Labels[label] = "true"
			log.WithField("label", label).WithField("node", nodeName).Info("adding label to node")
		} else {
			delete(node.Labels, label)
			log.WithField("label", label).WithField("node", nodeName).Info("removing label from node")
		}

		err = client.Update(ctx, &node)
		if err != nil {
			return err
		}

		return nil
	})
}

func checkTCPPortIsReachable(host string, port string) error {
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, port), 1*time.Second)
	if err != nil {
		return err
	}
	defer conn.Close()

	return nil
}

func checkRegistryFacade(host, port string) error {
	transport := newDefaultTransport()
	transport.TLSClientConfig = &tls.Config{
		InsecureSkipVerify: true,
	}

	client := &http.Client{
		Transport: transport,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	dummyURL := fmt.Sprintf("https://%v:%v/v2/remote/not-a-valid-image/manifests/latest", host, port)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, dummyURL, nil)
	if err != nil {
		return fmt.Errorf("building HTTP request: %v", err)
	}

	req.Header.Set("Accept", "application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json")
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("unexpected error during HTTP request: %v", err)
	}
	resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil
	}

	return fmt.Errorf("registry-facade is not ready yet")
}

func newDefaultTransport() *http.Transport {
	return &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   1 * time.Second,
			DualStack: false,
		}).DialContext,
		MaxIdleConns:          0,
		MaxIdleConnsPerHost:   1,
		IdleConnTimeout:       5 * time.Second,
		ExpectContinueTimeout: 5 * time.Second,
		DisableKeepAlives:     true,
	}
}
