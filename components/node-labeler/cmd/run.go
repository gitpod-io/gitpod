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
	"k8s.io/utils/ptr"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	"sigs.k8s.io/controller-runtime/pkg/manager"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	"sigs.k8s.io/controller-runtime/pkg/webhook"

	"github.com/gitpod-io/gitpod/common-go/log"
)

const (
	registryFacade = "registry-facade"
	wsDaemon       = "ws-daemon"

	// Taint keys for different components
	registryFacadeTaintKey = "gitpod.io/registry-facade-not-ready"
	wsDaemonTaintKey       = "gitpod.io/ws-daemon-not-ready"

	workspacesRegularLabel  = "gitpod.io/workload_workspace_regular"
	workspacesHeadlessLabel = "gitpod.io/workload_workspace_headless"
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
				SyncPeriod: ptr.To(time.Duration(2 * time.Minute)),
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

		r := &PodReconciler{
			mgr.GetClient(),
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
		nr := &NodeReconciler{
			mgr.GetClient(),
		}

		err = ctrl.NewControllerManagedBy(mgr).
			Named("node-watcher").
			For(&corev1.Node{}, builder.WithPredicates(predicate.Or(nr.nodeFilter()))).
			WithOptions(controller.Options{MaxConcurrentReconciles: 1}).
			Complete(nr)
		if err != nil {
			log.WithError(err).Fatal("unable to bind controller watch event handler")
		}

		go func() {
			<-mgr.Elected()
			if err := nr.reconcileAll(context.Background()); err != nil {
				log.WithError(err).Fatal("failed to reconcile all nodes")
			}
		}()

		if err := mgr.GetFieldIndexer().IndexField(context.Background(), &workspacev1.Workspace{}, "status.runtime.nodeName", func(o client.Object) []string {
			ws := o.(*workspacev1.Workspace)
			if ws.Status.Runtime == nil {
				return nil
			}
			return []string{ws.Status.Runtime.NodeName}
		}); err != nil {
			log.WithError(err).Fatal("unable to create workspace indexer")
			return
		}

		if err := mgr.GetFieldIndexer().IndexField(context.Background(), &corev1.Pod{}, "spec.nodeName", func(o client.Object) []string {
			pod := o.(*corev1.Pod)
			if pod.Spec.NodeName == "" {
				return nil
			}
			return []string{pod.Spec.NodeName}
		}); err != nil {
			log.WithError(err).Fatal("unable to create pod indexer")
			return
		}

		nsac, err := NewNodeScaledownAnnotationController(mgr.GetClient())
		if err != nil {
			log.WithError(err).Fatal("unable to create node scaledown annotation controller")
		}
		err = nsac.SetupWithManager(mgr)
		if err != nil {
			log.WithError(err).Fatal("unable to bind node scaledown annotation controller")
		}

		err = mgr.Add(manager.RunnableFunc(func(ctx context.Context) error {
			<-ctx.Done()
			log.Info("Received shutdown signal - stopping NodeScaledownAnnotationController")
			nsac.Stop()
			return nil
		}))
		if err != nil {
			log.WithError(err).Fatal("couldn't properly clean up node scaledown annotation controller")
		}
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

	var taintKey string
	switch {
	case strings.HasPrefix(pod.Name, registryFacade):
		taintKey = registryFacadeTaintKey
	case strings.HasPrefix(pod.Name, wsDaemon):
		taintKey = wsDaemonTaintKey
	default:
		// nothing to do
		return reconcile.Result{}, nil
	}

	healthy, err := checkPodHealth(pod)
	if err != nil {
		log.WithError(err).Error("cannot check pod health")
		return reconcile.Result{RequeueAfter: defaultRequeueTime}, nil
	}

	var node corev1.Node
	err = r.Get(ctx, types.NamespacedName{Name: nodeName}, &node)
	if err != nil {
		if !errors.IsNotFound(err) {
			log.WithError(err).Error("cannot get node")
		}
		return reconcile.Result{}, client.IgnoreNotFound(err)
	}

	if isNodeTaintExists(taintKey, node) != healthy {
		// nothing to do, the taint already exists and is in the desired state.
		return reconcile.Result{}, nil
	}

	err = updateNodeTaint(taintKey, !healthy, nodeName, r)
	if err != nil {
		log.WithError(err).
			WithField("taintKey", taintKey).
			WithField("add", !healthy).
			WithField("nodeName", nodeName).
			Error("cannot update node taint")
		return reconcile.Result{RequeueAfter: defaultRequeueTime}, nil
	}

	return reconcile.Result{}, nil
}

func checkPodHealth(pod corev1.Pod) (bool, error) {
	var (
		ipAddress string
		port      string
	)
	switch {
	case strings.HasPrefix(pod.Name, registryFacade):
		ipAddress = pod.Status.HostIP
		port = strconv.Itoa(registryFacadePort)
	case strings.HasPrefix(pod.Name, wsDaemon):
		ipAddress = pod.Status.PodIP
		port = strconv.Itoa(wsdaemonPort)
	default:
		// nothing to do
		return true, nil
	}

	if !pod.ObjectMeta.DeletionTimestamp.IsZero() {
		// the pod is being removed.
		// add the taint to the node
		return false, nil
	}

	if !IsPodReady(pod) {
		// not ready. Wait until the next update.
		return false, nil
	}

	err := checkTCPPortIsReachable(ipAddress, port)
	if err != nil {
		log.WithField("host", ipAddress).WithField("port", port).WithField("pod", pod.Name).WithError(err).Error("checking if TCP port is open")
		return false, nil
	}

	if strings.HasPrefix(pod.Name, registryFacade) {
		err = checkRegistryFacade(ipAddress, port)
		if err != nil {
			log.WithError(err).Error("checking registry-facade")
			return false, nil
		}
	}

	return true, nil
}

type NodeReconciler struct {
	client.Client
}

func (r *NodeReconciler) nodeFilter() predicate.Predicate {
	return predicate.Funcs{
		CreateFunc: func(e event.CreateEvent) bool {
			node, ok := e.Object.(*corev1.Node)
			if !ok {
				return false
			}
			return isWorkspaceNode(*node)
		},
		UpdateFunc: func(e event.UpdateEvent) bool {
			return false
		},
		DeleteFunc: func(e event.DeleteEvent) bool {
			return false
		},
	}
}

func (r *NodeReconciler) reconcileAll(ctx context.Context) error {
	log.Info("start reconciling all nodes")

	var nodes corev1.NodeList
	if err := r.List(ctx, &nodes); err != nil {
		return fmt.Errorf("failed to list nodes: %w", err)
	}

	for _, node := range nodes.Items {
		if node.Labels == nil {
			continue
		}
		if !isWorkspaceNode(node) {
			continue
		}

		r.Reconcile(ctx, reconcile.Request{NamespacedName: types.NamespacedName{Name: node.Name}})
	}

	log.Info("finished reconciling all nodes")
	return nil
}

func (r *NodeReconciler) Reconcile(ctx context.Context, req reconcile.Request) (reconcile.Result, error) {
	var node corev1.Node
	err := r.Get(ctx, req.NamespacedName, &node)
	if err != nil {
		if !errors.IsNotFound(err) {
			log.WithError(err).Error("unable to fetch node")
		}
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}
	var podList corev1.PodList
	err = r.List(ctx, &podList, client.MatchingFields{
		"spec.nodeName": node.Name,
	})
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("cannot list pods: %w", err)
	}
	isWsdaemonTaintExists := isNodeTaintExists(wsDaemonTaintKey, node)
	isRegistryFacadeTaintExists := isNodeTaintExists(registryFacadeTaintKey, node)
	isWsDaemonReady, isRegistryFacadeReady := false, false
	for _, pod := range podList.Items {
		if strings.HasPrefix(pod.Name, wsDaemon) {
			isWsDaemonReady, err = checkPodHealth(pod)
			if err != nil {
				log.WithError(err).Error("checking pod health")
			}
		}
		if strings.HasPrefix(pod.Name, registryFacade) {
			isRegistryFacadeReady, err = checkPodHealth(pod)
			if err != nil {
				log.WithError(err).Error("checking pod health")
			}
		}
	}
	if isWsDaemonReady == isWsdaemonTaintExists {
		updateNodeTaint(wsDaemonTaintKey, !isWsDaemonReady, node.Name, r)
	}
	if isRegistryFacadeReady == isRegistryFacadeTaintExists {
		updateNodeTaint(registryFacadeTaintKey, !isRegistryFacadeReady, node.Name, r)
	}
	return reconcile.Result{}, nil
}

type NodeScaledownAnnotationController struct {
	client.Client
	nodesToReconcile chan string
	stopChan         chan struct{}
}

func NewNodeScaledownAnnotationController(client client.Client) (*NodeScaledownAnnotationController, error) {
	controller := &NodeScaledownAnnotationController{
		Client:           client,
		nodesToReconcile: make(chan string, 1000),
		stopChan:         make(chan struct{}),
	}

	return controller, nil
}

func (c *NodeScaledownAnnotationController) SetupWithManager(mgr ctrl.Manager) error {
	go c.reconciliationWorker()
	go c.periodicReconciliation()

	return ctrl.NewControllerManagedBy(mgr).
		Named("node-scaledown-annotation-controller").
		For(&workspacev1.Workspace{}).
		WithEventFilter(c.workspaceFilter()).
		Complete(c)
}

// periodicReconciliation periodically reconciles all nodes in the cluster
func (c *NodeScaledownAnnotationController) periodicReconciliation() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			log.Info("starting periodic full reconciliation")
			ctx := context.Background()
			if _, err := c.reconcileAllNodes(ctx); err != nil {
				log.WithError(err).Error("periodic reconciliation failed")
			}
		case <-c.stopChan:
			log.Info("stopping periodic full reconciliation")
			return
		}
	}
}

// reconciliationWorker consumes nodesToReconcile and reconciles each node
func (c *NodeScaledownAnnotationController) reconciliationWorker() {
	log.Info("reconciliation worker started")
	for {
		select {
		case nodeName := <-c.nodesToReconcile:
			ctx := context.Background()
			if err := c.reconcileNode(ctx, nodeName); err != nil {
				log.WithError(err).WithField("node", nodeName).Error("failed to reconcile node from queue")
			}
		case <-c.stopChan:
			log.Info("reconciliation worker stopping")
			return
		}
	}
}

func (c *NodeScaledownAnnotationController) workspaceFilter() predicate.Predicate {
	return predicate.Funcs{
		CreateFunc: func(e event.CreateEvent) bool {
			ws := e.Object.(*workspacev1.Workspace)
			if ws.Status.Runtime == nil {
				log.WithField("workspace", ws.Name).Info("workspace not ready yet")
				return false
			}

			return ws.Status.Runtime != nil && ws.Status.Runtime.NodeName != ""
		},
		UpdateFunc: func(e event.UpdateEvent) bool {
			wsOld := e.ObjectOld.(*workspacev1.Workspace)
			ws := e.ObjectNew.(*workspacev1.Workspace)
			// if we haven't seen runtime info before and now it's there, let's reconcile.
			// similarly, if the node name changed, we need to reconcile the old node as well.
			if (wsOld.Status.Runtime == nil && ws.Status.Runtime != nil && ws.Status.Runtime.NodeName != "") || // we just got runtime info
				(wsOld.Status.Runtime != nil && ws.Status.Runtime != nil && wsOld.Status.Runtime.NodeName != ws.Status.Runtime.NodeName) { // node name changed
				if wsOld.Status.Runtime != nil && wsOld.Status.Runtime.NodeName != "" {
					c.queueNodeForReconciliation(wsOld.Status.Runtime.NodeName)
				}
				return true
			}

			return false
		},
		DeleteFunc: func(e event.DeleteEvent) bool {
			ws := e.Object.(*workspacev1.Workspace)
			if ws.Status.Runtime != nil && ws.Status.Runtime.NodeName != "" {
				c.queueNodeForReconciliation(ws.Status.Runtime.NodeName)
				return true
			}
			return false
		},
	}
}

func (c *NodeScaledownAnnotationController) queueNodeForReconciliation(nodeName string) {
	select {
	case c.nodesToReconcile <- nodeName:
		log.WithField("node", nodeName).Info("queued node for reconciliation")
	default:
		log.WithField("node", nodeName).Warn("reconciliation queue full")
	}
}

func (c *NodeScaledownAnnotationController) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log.WithField("request", req.NamespacedName.String()).Info("WorkspaceCountController reconciling")

	var ws workspacev1.Workspace
	if err := c.Get(ctx, req.NamespacedName, &ws); err != nil {
		if !errors.IsNotFound(err) {
			log.WithError(err).WithField("workspace", req.NamespacedName).Error("unable to fetch Workspace")
			return ctrl.Result{}, err
		}
		return ctrl.Result{}, nil
	}

	if ws.Status.Runtime != nil && ws.Status.Runtime.NodeName != "" {
		c.queueNodeForReconciliation(ws.Status.Runtime.NodeName)
	}

	log.WithField("runtime", ws.Status.Runtime).Warn("reconciling object with no Runtime/NodeName, which wasn't filtered out by workspaceFilter")
	return ctrl.Result{}, nil
}

// Cleanup method to be called when shutting down the controller
func (wc *NodeScaledownAnnotationController) Stop() {
	close(wc.stopChan)
}

func (c *NodeScaledownAnnotationController) reconcileAllNodes(ctx context.Context) (ctrl.Result, error) {
	var nodes corev1.NodeList
	if err := c.List(ctx, &nodes); err != nil {
		log.WithError(err).Error("failed to list nodes")
		return ctrl.Result{}, err
	}

	for _, node := range nodes.Items {
		c.queueNodeForReconciliation(node.Name)
	}

	return ctrl.Result{}, nil
}

func (c *NodeScaledownAnnotationController) reconcileNode(ctx context.Context, nodeName string) error {
	var workspaceList workspacev1.WorkspaceList
	if err := c.List(ctx, &workspaceList, client.MatchingFields{
		"status.runtime.nodeName": nodeName,
	}); err != nil {
		return fmt.Errorf("failed to list workspaces: %w", err)
	}

	log.WithField("node", nodeName).WithField("count", len(workspaceList.Items)).Info("acting on workspaces")
	count := len(workspaceList.Items)

	return c.updateNodeAnnotation(ctx, nodeName, count)
}

func (c *NodeScaledownAnnotationController) updateNodeAnnotation(ctx context.Context, nodeName string, count int) error {
	return retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()

		var node corev1.Node
		err := c.Get(ctx, types.NamespacedName{Name: nodeName}, &node)
		if err != nil {
			return fmt.Errorf("obtaining node %s: %w", nodeName, err)
		}

		shouldDisableScaleDown := count > 0
		currentlyDisabled := false
		if val, exists := node.Annotations["cluster-autoscaler.kubernetes.io/scale-down-disabled"]; exists {
			currentlyDisabled = val == "true"
		}

		// Only update if the state needs to change
		if shouldDisableScaleDown != currentlyDisabled {
			if node.Annotations == nil {
				node.Annotations = make(map[string]string)
			}

			if shouldDisableScaleDown {
				node.Annotations["cluster-autoscaler.kubernetes.io/scale-down-disabled"] = "true"
				log.WithField("nodeName", nodeName).Info("disabling scale-down for node")
			} else {
				delete(node.Annotations, "cluster-autoscaler.kubernetes.io/scale-down-disabled")
				log.WithField("nodeName", nodeName).Info("enabling scale-down for node")
			}

			return c.Update(ctx, &node)
		}

		return nil
	})
}

func updateNodeTaint(taintKey string, add bool, nodeName string, client client.Client) error {
	return retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var node corev1.Node
		err := client.Get(ctx, types.NamespacedName{Name: nodeName}, &node)
		if err != nil {
			if !errors.IsNotFound(err) {
				return err
			}
			return nil
		}

		// Create or remove taint
		if add {
			// Add taint if it doesn't exist
			taintExists := false
			for _, taint := range node.Spec.Taints {
				if taint.Key == taintKey {
					taintExists = true
					break
				}
			}
			if !taintExists {
				node.Spec.Taints = append(node.Spec.Taints, corev1.Taint{
					Key:    taintKey,
					Value:  "true",
					Effect: corev1.TaintEffectNoSchedule,
				})
				log.WithField("taint", taintKey).WithField("node", nodeName).Info("adding taint to node")
			}
		} else {
			// Remove taint if it exists
			newTaints := make([]corev1.Taint, 0)
			for _, taint := range node.Spec.Taints {
				if taint.Key != taintKey {
					newTaints = append(newTaints, taint)
				}
			}
			if len(newTaints) != len(node.Spec.Taints) {
				node.Spec.Taints = newTaints
				log.WithField("taint", taintKey).WithField("node", nodeName).Info("removing taint from node")
			}
		}

		err = client.Update(ctx, &node)
		if err != nil {
			return err
		}

		return nil
	})
}

func isNodeTaintExists(taintKey string, node corev1.Node) bool {
	for _, taint := range node.Spec.Taints {
		if taint.Key == taintKey {
			return true
		}
	}
	return false
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

func isWorkspaceNode(node corev1.Node) bool {
	_, isRegularWorkspaceNode := node.Labels[workspacesRegularLabel]
	_, isHeadlessWorkspaceNode := node.Labels[workspacesHeadlessLabel]
	return isRegularWorkspaceNode || isHeadlessWorkspaceNode
}
