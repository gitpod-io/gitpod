package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// This is a test utility that is used to inject a very specific error condition into workspace pods, so that we can test the behavior of the ws-manager+ws-daemon in handling such cases.

type patchStringValue struct {
	Op    string `json:"op"`
	Path  string `json:"path"`
	Value string `json:"value"`
}

func main() {
	// Get Kubernetes client
	clientset, err := getClient()
	if err != nil {
		fmt.Printf("Error creating Kubernetes client: %v\n", err)
		os.Exit(1)
	}

	namespace := "default"
	ctx := context.Background()

	// Listen for pod events
	podWatcher, err := clientset.CoreV1().Pods(namespace).Watch(ctx, metav1.ListOptions{
		LabelSelector: "component=workspace",
	})
	if err != nil {
		fmt.Printf("Error watching pods: %v\n", err)
		os.Exit(1)
	}

	// Handle pod events
	ch := podWatcher.ResultChan()
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, syscall.SIGINT, syscall.SIGTERM)

	fmt.Println("Starting rejector...")

	knownPodVersions := map[string]string{}
	podRejectedCount := map[string]int{}

	for {
		select {
		case event := <-ch:
			pod, ok := event.Object.(*corev1.Pod)
			if !ok {
				fmt.Println("Unexpected type")
				continue
			}

			marked := true
			// marked := slices.ContainsFunc(pod.Spec.Containers[0].Env, func(e corev1.EnvVar) bool {
			// 	return e.Name == "GITPOD_WORKSPACE_CONTEXT_URL" && strings.Contains(e.Value, "geropl")
			// })

			knownVersion, known := knownPodVersions[pod.Name]
			if known && knownVersion >= pod.ResourceVersion {
				fmt.Printf("Skipping pod %s bc of outdated version...\n", pod.Name)
				continue
			}

			if count := podRejectedCount[pod.Name]; count > 0 || !marked {
				fmt.Printf("Skipping pod %s...\n", pod.Name)
				continue
			}
			fmt.Printf("Found marked pod %s\n", pod.Name)

			if pod.Status.Phase == corev1.PodPending && pod.Spec.NodeName != "" {
				fmt.Printf("found marked pending & scheduled pod: %s\n", pod.Name)
				patch := []patchStringValue{
					{
						Path:  "/status/phase",
						Op:    "replace",
						Value: string(corev1.PodFailed),
					},
					{
						Path:  "/status/reason",
						Op:    "replace",
						Value: "NodeAffinity",
					},
					{
						Path:  "/status/message",
						Op:    "replace",
						Value: "Pod was rejected",
					},
				}
				patchBytes, _ := json.Marshal(patch)
				pUpdated, err := clientset.CoreV1().Pods(namespace).Patch(ctx, pod.Name, types.JSONPatchType, patchBytes, metav1.PatchOptions{}, "status")
				if err != nil {
					fmt.Printf("error patching pod %s: %v\n", pod.Name, err)
				}
				podRejectedCount[pod.Name] = podRejectedCount[pod.Name] + 1
				knownPodVersions[pUpdated.Name] = pUpdated.ResourceVersion
				fmt.Printf("Applied status: %s\n", pUpdated.Status.Phase)
			}

		case <-stopChan:
			fmt.Println("Shutting down rejector...")
			return
		}
	}
}

// Function to get the Kubernetes client
func getClient() (*kubernetes.Clientset, error) {
	var config *rest.Config
	var err error

	// Try to get in-cluster config
	config, err = rest.InClusterConfig()
	if err != nil {
		// Fall back to using kubeconfig file if not running in a cluster
		kubeconfigFlag := flag.String("kubeconfig", "~/.kube/config", "location of your kubeconfig file")
		flag.Parse()
		kubeconfig, err := filepath.Abs(*kubeconfigFlag)
		if err != nil {
			fmt.Printf("Cannot resolve kubeconfig path: %s", *kubeconfigFlag)
		}
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, err
		}
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, err
	}
	return clientset, nil
}
