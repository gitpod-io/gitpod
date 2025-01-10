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
	"github.com/spf13/cobra"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
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

		// the pod count reconciler needs an index on spec.nodeName to be able to list pods by node
		if err := mgr.GetFieldIndexer().IndexField(
			context.Background(),
			&corev1.Pod{},
			"spec.nodeName",
			func(o client.Object) []string {
				pod := o.(*corev1.Pod)
				return []string{pod.Spec.NodeName}
			}); err != nil {
			log.WithError(err).Fatal("unable to create index for pod nodeName")
		}

		pc, err := NewPodCountController(mgr.GetClient())
		if err != nil {
			log.WithError(err).Fatal("unable to create pod count controller")
		}
		err = pc.SetupWithManager(mgr)
		if err != nil {
			log.WithError(err).Fatal("unable to bind pod count controller")
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

type PodCountController struct {
	client.Client
}

// NewPodCountController creates a controller that tracks workspace pod counts and updates node annotations
func NewPodCountController(client client.Client) (*PodCountController, error) {
	return &PodCountController{
		Client: client,
	}, nil
}

func (pc *PodCountController) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		Named("pod-count").
		For(&corev1.Pod{}).
		WithEventFilter(workspacePodFilter()).
		Complete(pc)
}

func workspacePodFilter() predicate.Predicate {
	return predicate.Funcs{
		CreateFunc: func(e event.CreateEvent) bool {
			pod := e.Object.(*corev1.Pod)
			return pod.Labels["component"] == "workspace"
		},
		UpdateFunc: func(e event.UpdateEvent) bool {
			return false
		},
		DeleteFunc: func(e event.DeleteEvent) bool {
			pod := e.Object.(*corev1.Pod)
			return pod.Labels["component"] == "workspace"
		},
	}
}

func (pc *PodCountController) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log.WithField("request", req.NamespacedName.String()).Info("PodCountController reconciling")

	var pod corev1.Pod
	if err := pc.Get(ctx, req.NamespacedName, &pod); err != nil {
		if !errors.IsNotFound(err) {
			log.WithError(err).WithField("pod", req.NamespacedName).Error("unable to fetch Pod")
			return ctrl.Result{}, err
		}

		log.WithField("pod", req.NamespacedName).Info("Pod not found, assuming it was deleted, reconciling all nodes")

		// Pod was deleted, reconcile all nodes
		return pc.reconcileAllNodes(ctx)
	}

	if pod.Spec.NodeName == "" {
		log.WithField("pod", req.NamespacedName).Info("Pod has no node, requesting reconciliation")
		return ctrl.Result{RequeueAfter: 5 * time.Second}, nil
	}

	return pc.reconcileNode(ctx, pod.Spec.NodeName)
}

func (pc *PodCountController) reconcileAllNodes(ctx context.Context) (ctrl.Result, error) {
	var nodes corev1.NodeList
	if err := pc.List(ctx, &nodes); err != nil {
		log.WithError(err).Error("failed to list nodes")
		return ctrl.Result{}, err
	}

	for _, node := range nodes.Items {
		if _, err := pc.reconcileNode(ctx, node.Name); err != nil {
			log.WithError(err).WithField("node", node.Name).Error("failed to reconcile node")
			// Continue with other nodes even if one fails
			continue
		}
		log.WithField("node", node.Name).Info("reconciled node")
	}

	return ctrl.Result{}, nil
}

func (pc *PodCountController) reconcileNode(ctx context.Context, nodeName string) (ctrl.Result, error) {
	var podList corev1.PodList
	err := pc.List(ctx, &podList, &client.ListOptions{
		FieldSelector: fields.SelectorFromSet(fields.Set{"spec.nodeName": nodeName}),
		LabelSelector: labels.SelectorFromSet(labels.Set{"component": "workspace"}),
	})
	if err != nil {
		log.WithError(err).WithField("nodeName", nodeName).Error("failed to list pods")
		return ctrl.Result{}, fmt.Errorf("failed to list pods: %w", err)
	}

	workspaceCount := len(podList.Items)
	log.WithField("nodeName", nodeName).WithField("workspaceCount", workspaceCount).Info("reconciling node")

	err = retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		var node corev1.Node
		err := pc.Get(ctx, types.NamespacedName{Name: nodeName}, &node)
		if err != nil {
			return fmt.Errorf("obtaining node %s: %w", nodeName, err)
		}

		if node.Annotations == nil {
			node.Annotations = make(map[string]string)
		}

		if workspaceCount > 0 {
			node.Annotations["cluster-autoscaler.kubernetes.io/scale-down-disabled"] = "true"
			log.WithField("nodeName", nodeName).Info("disabling scale-down for node")
		} else {
			delete(node.Annotations, "cluster-autoscaler.kubernetes.io/scale-down-disabled")
			log.WithField("nodeName", nodeName).Info("enabling scale-down for node")
		}

		return pc.Update(ctx, &node)
	})
	if err != nil {
		log.WithError(err).WithField("nodeName", nodeName).Error("failed to update node")
		return ctrl.Result{}, fmt.Errorf("failed to update node: %w", err)
	}

	return ctrl.Result{}, nil
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
