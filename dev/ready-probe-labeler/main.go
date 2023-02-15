// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/spf13/pflag"
	"golang.org/x/net/context"
	"golang.org/x/xerrors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/retry"

	"github.com/gitpod-io/gitpod/common-go/log"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "ready-probe-labeler"
	// Version of this service - set during build
	Version = ""
)

var opts struct {
	JSONLog    bool
	Verbose    bool
	Shutdown   bool
	Kubeconfig string
	Label      string
	ProbeURL   string
	HostPort   int
	Timeout    time.Duration
}

func main() {
	pflag.BoolVarP(&opts.JSONLog, "json-log", "j", true, "produce JSON log output on verbose level")
	pflag.BoolVarP(&opts.Shutdown, "shutdown", "s", false, "Removes the node label prior to a pod stop")
	pflag.StringVarP(&opts.Label, "label", "l", "", "Gitpod component Label")
	pflag.BoolVarP(&opts.Verbose, "verbose", "v", false, "Enable verbose JSON logging")
	pflag.StringVarP(&opts.Kubeconfig, "kubeconfig", "k", "", "Kubeconfig file path")
	pflag.StringVarP(&opts.ProbeURL, "probe-url", "p", "http://localhost:9501/ready", "URL to test the readiness of a service")
	pflag.DurationVarP(&opts.Timeout, "timeout", "t", 60*time.Second, "W")
	pflag.IntVarP(&opts.HostPort, "host-port", "h", 0, "Check if the host port is reachable before adding a label")
	pflag.Parse()

	log.Init(ServiceName, Version, opts.JSONLog, opts.Verbose)

	log.Info("Starting node labeler...")

	if opts.Label == "" {
		log.Fatalf("Please set the flag --label")
	}

	nodeName := os.Getenv("NODENAME")
	if nodeName == "" {
		log.Fatalf("Environment variable NODENAME is not defined")
	}

	client, err := getKubeClient(opts.Kubeconfig)
	if err != nil {
		log.Fatalf("Unexpected error: %v", err)
	}

	err = updateLabel(opts.Label, false, nodeName, client)
	if err != nil {
		log.Fatalf("Unexpected error removing node label: %v", err)
	}

	if opts.Shutdown {
		return
	}

	start := time.Now()

	err = waitForURLToBeReachable(opts.ProbeURL, opts.Timeout)
	if err != nil {
		log.Fatalf("Unexpected error waiting for probe URL: %v", err)
	}

	nodeIP := os.Getenv("NODEIP")
	if opts.HostPort != 0 && nodeIP != "" {
		log.Infof("Waiting for port %v on host %v...", opts.HostPort, nodeIP)
		err := waitForTCPPortToBeReachable(nodeIP, strconv.Itoa(opts.HostPort), opts.Timeout)
		if err != nil {
			log.Fatalf("Unexpected error waiting for port %v on host %v: %v", opts.HostPort, nodeIP, err)
		}

		time.Sleep(5 * time.Second)
	}

	err = updateLabel(opts.Label, true, nodeName, client)
	if err != nil {
		log.Fatalf("Unexpected error while trying to add the label: %v", err)
	}

	log.WithField("node", nodeName).WithField("time", time.Since(start).Seconds()).Info("node label updated")

	// wait for termination
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	log.Info("Received SIGINT - shutting down")
}

func updateLabel(label string, add bool, nodeName string, clientset *kubernetes.Clientset) error {
	return retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		node, err := clientset.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
		if err != nil {
			return err
		}

		_, hasLabel := node.Labels[label]
		if add == hasLabel {
			return nil
		}

		if add {
			node.Labels[label] = "true"
			log.WithField("label", label).Info("adding label to node")
		} else {
			delete(node.Labels, label)
			log.WithField("label", label).Info("removing label from node")
		}

		_, err = clientset.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
		if err != nil {
			return err
		}

		return nil
	})
}

func getKubeClient(kubeconfig string) (*kubernetes.Clientset, error) {
	var cannotConnectToK8s = func(err error) error {
		return xerrors.Errorf("cannot connect to kubernetes: %w", err)
	}

	if kubeconfig != "" {
		res, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, cannotConnectToK8s(err)
		}

		clientset, err := kubernetes.NewForConfig(res)
		if err != nil {
			return nil, cannotConnectToK8s(err)
		}

		return clientset, nil
	}

	icc, err := rest.InClusterConfig()
	if err != nil {
		return nil, cannotConnectToK8s(err)
	}

	clientset, err := kubernetes.NewForConfig(icc)
	if err != nil {
		return nil, cannotConnectToK8s(err)
	}

	return clientset, nil
}

func waitForURLToBeReachable(probeURL string, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return xerrors.Errorf("URL %v never returned status code 200", probeURL)
		case <-ticker.C:
			req, err := http.NewRequestWithContext(ctx, "GET", probeURL, nil)
			if err != nil {
				continue
			}

			client := &http.Client{}
			resp, err := client.Do(req)
			if err != nil {
				continue
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				continue
			}

			return nil
		}
	}
}

func waitForTCPPortToBeReachable(host string, port string, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return xerrors.Errorf("port %v on host %v never reachable", port, host)
		case <-ticker.C:
			conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, port), timeout)
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
