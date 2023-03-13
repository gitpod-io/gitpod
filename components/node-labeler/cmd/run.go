// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/bombsimon/logrusr/v2"
	"github.com/spf13/cobra"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	_ "k8s.io/client-go/plugin/pkg/client/auth"
	"k8s.io/client-go/util/retry"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	"sigs.k8s.io/controller-runtime/pkg/metrics"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	"sigs.k8s.io/controller-runtime/pkg/source"

	"github.com/gitpod-io/gitpod/common-go/log"
)

const (
	registryFacadeLabel = "gitpod.io/registry-facade_ready_ns_%v"
	wsdaemonLabel       = "gitpod.io/ws-daemon_ready_ns_%v"

	registryFacade = "registry-facade"
	wsDaemon       = "ws-daemon"
)

// serveCmd represents the serve command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts the node labeler",
	Run: func(cmd *cobra.Command, args []string) {
		ctrl.SetLogger(logrusr.New(log.Log))

		mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
			Scheme:                 scheme,
			MetricsBindAddress:     "127.0.0.1:9500",
			HealthProbeBindAddress: ":8086",
			LeaderElection:         true,
			LeaderElectionID:       "node-labeler.gitpod.io",
			Namespace:              namespace,
		})
		if err != nil {
			log.WithError(err).Fatal("unable to start node-labeber")
		}

		client, err := client.New(ctrl.GetConfigOrDie(), client.Options{})
		if err != nil {
			log.WithError(err).Fatal("unable to create client")
		}

		r := &PodReconciler{
			client,
		}

		c, err := controller.New("pod-watcher", mgr, controller.Options{Reconciler: r})
		if err != nil {
			log.WithError(err).Fatal("unable to bind controller watch event handler")
		}

		metrics.Registry.MustRegister(NodeLabelerCounterVec)
		metrics.Registry.MustRegister(NodeLabelerTimeHistVec)

		err = c.Watch(&source.Kind{Type: &corev1.Pod{}}, &handler.EnqueueRequestForObject{}, predicate.Funcs{
			CreateFunc: func(ce event.CreateEvent) bool {
				return processPodEvent(ce.Object)
			},
			UpdateFunc: func(ue event.UpdateEvent) bool {
				return processPodEvent(ue.ObjectNew)
			},
			DeleteFunc: func(deleteEvent event.DeleteEvent) bool {
				return processPodEvent(deleteEvent.Object)
			},
			GenericFunc: func(genericEvent event.GenericEvent) bool {
				return false
			},
		})
		if err != nil {
			log.WithError(err).Fatal("unable to create controller")
		}

		err = mgr.AddHealthzCheck("healthz", healthz.Ping)
		if err != nil {
			log.WithError(err).Fatal("unable to set up health check")
		}

		err = mgr.AddReadyzCheck("readyz", healthz.Ping)
		if err != nil {
			log.WithError(err).Fatal("unable to set up ready check")
		}

		log.Info("starting node-labeber")
		err = mgr.Start(ctrl.SetupSignalHandler())
		if err != nil {
			log.WithError(err).Fatal("problem running node-labeber")
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

func processPodEvent(pod client.Object) bool {
	if strings.HasPrefix(pod.GetName(), registryFacade) || strings.HasPrefix(pod.GetName(), wsDaemon) {
		return true
	}

	return false
}

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
		return reconcile.Result{RequeueAfter: time.Second * 10}, err
	}

	var (
		ipAddress     string
		port          string
		component     string
		labelToUpdate string

		waitTimeout time.Duration = 1 * time.Second
	)

	switch {
	case strings.HasPrefix(pod.Name, registryFacade):
		component = registryFacade
		labelToUpdate = fmt.Sprintf(registryFacadeLabel, namespace)
		ipAddress = pod.Status.HostIP
		port = strconv.Itoa(registryFacadePort)
		// wait for kube-proxy sync to avoid connection refused due to missing nodeport rules
		waitTimeout = 15 * time.Second
	case strings.HasPrefix(pod.Name, wsDaemon):
		component = wsDaemon
		labelToUpdate = fmt.Sprintf(wsdaemonLabel, namespace)
		ipAddress = pod.Status.PodIP
		port = strconv.Itoa(wsdaemonPort)
	default:
		log.WithField("pod", pod.Name).Info("Invalid pod. Skipping...")
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

			log.WithError(err).Error("unexpected error removing node label")
			return reconcile.Result{RequeueAfter: time.Second * 10}, err
		}

		return reconcile.Result{}, err
	}

	if !IsPodReady(&pod) {
		// not ready. Wait until the next update.
		return reconcile.Result{}, nil
	}

	err = waitForTCPPortToBeReachable(ipAddress, port, 30*time.Second)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("Unexpected error waiting for probe URL: %v", err)
	}

	time.Sleep(waitTimeout)

	err = updateLabel(labelToUpdate, true, nodeName, r)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("Unexpected error while trying to add the label: %v", err)
	}

	readyIn := time.Since(pod.Status.StartTime.Time)
	NodeLabelerTimeHistVec.WithLabelValues(component).Observe(readyIn.Seconds())
	NodeLabelerCounterVec.WithLabelValues(component).Inc()

	return reconcile.Result{}, nil
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

		_, hasLabel := node.Labels[label]
		if add == hasLabel {
			return nil
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

func waitForTCPPortToBeReachable(host string, port string, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("port %v on host %v never reachable", port, host)
		case <-ticker.C:
			conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, port), 500*time.Millisecond)
			if err != nil {
				continue
			}

			if conn != nil {
				conn.Close()
				return nil
			}

			continue
		}
	}
}
