// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/gitpod-io/gitpod/common-go/log"

	"github.com/spf13/cobra"
	corev1 "k8s.io/api/core/v1"
	res "k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
)

// Easiest way to execute this:
// kubectl exec -it ws-scheduler-... -- sh
// cd app
// ./ws-scheduler test generate-scheduling-pressure --namespace=staging-gpl-fix-ws-scheduler --size=0.01 --pod-count=10

var pressureTestPodLabels labels.Set = map[string]string{
	"component": "test-pressure",
}

// testSchedulingPressureCmd generates some load for the scheduler
var testSchedulingPressureCmd = &cobra.Command{
	Use:   "generate-scheduling-pressure",
	Short: "Generates scheduling pressure on the workspace-scheduler",
	Args:  cobra.RangeArgs(0, 3),
	Run: func(cmd *cobra.Command, args []string) {
		podNamespace, _ := cmd.Flags().GetString("namespace")
		podCount, _ := cmd.Flags().GetInt("pod-count")
		podSizeInGb, _ := cmd.Flags().GetFloat32("size")

		clientSet, err := newClientSet()
		if err != nil {
			log.WithError(err).Fatal("cannot connect to Kubernetes")
		}
		log.Info("connected to Kubernetes")

		sigChan := make(chan os.Signal, 1)
		stopChan := make(chan struct{}, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-sigChan
			log.Debug("received signal, quitting.")
			stopChan <- struct{}{}
		}()

		log.Infof("starting pods with (%s, %d, %f)...", podNamespace, podCount, podSizeInGb)
		err = generateSchedulingPressure(clientSet, podNamespace, podCount, podSizeInGb)
		if err != nil {
			log.WithError(err).Error("error while generating scheduling pressure")
		}
		log.Info("done starting pods.")

		log.Info("will delete all pods on Ctrl-C")
		<-stopChan

		cleanupPressureTest(clientSet, podNamespace, pressureTestPodLabels)
	},
}

func generateSchedulingPressure(clientSet *kubernetes.Clientset, podNamespace string, podCount int, podSizeInGb float32) error {
	var wg sync.WaitGroup
	for p := 0; p < podCount; p++ {
		name := fmt.Sprintf("pressure-pod-%d", p)

		wg.Add(1)
		// for some reason the k8s master is extremely slow with creating pods. The only thing that helped was to call
		// it in a goroutine: Although there still is the initial delay the actual creation happens in parallel.
		go func() {
			err := createPod(clientSet, "workspace-scheduler", podNamespace, name, podSizeInGb)
			if err != nil {
				log.WithError(err).Errorf("Done starting pod: %s", name)
			} else {
				log.Debugf("Done starting pod: %s", name)
			}
			wg.Done()
		}()
	}
	wg.Wait()

	return nil
}

func createPod(clientSet *kubernetes.Clientset, scheduler string, namespace string, name string, ramInGb float32) error {
	boolTrue := true
	boolFalse := false
	gitpodUser := int64(33333)
	pod := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels:    pressureTestPodLabels,
		},
		Spec: corev1.PodSpec{
			ServiceAccountName: "workspace",
			SchedulerName:      scheduler,
			Affinity: &corev1.Affinity{
				NodeAffinity: &corev1.NodeAffinity{
					RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
						NodeSelectorTerms: []corev1.NodeSelectorTerm{
							{
								MatchExpressions: []corev1.NodeSelectorRequirement{
									{
										Key:      "gitpod.io/workload_workspace",
										Operator: corev1.NodeSelectorOpIn,
										Values:   []string{"true"},
									},
								},
							},
						},
					},
				},
			},
			SecurityContext: &corev1.PodSecurityContext{
				RunAsUser:    &gitpodUser,
				RunAsNonRoot: &boolTrue,
			},
			Containers: []corev1.Container{
				{
					Name:    "main",
					Image:   "eu.gcr.io/gitpod-dev/workspace-images:7e01b3299b178278c88c5a4606bdeed09059e94e8a7a193b249606028cfd13dd",
					Command: []string{"bash", "-c", "while true; do sleep 2; echo 'sleeping...'; done"},
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{
							"memory": res.MustParse(fmt.Sprintf("%d", int(ramInGb*1024*1024*1024))),
						},
					},
					SecurityContext: &corev1.SecurityContext{
						AllowPrivilegeEscalation: &boolFalse,
						RunAsUser:                &gitpodUser,
						Privileged:               &boolFalse,
						RunAsNonRoot:             &boolTrue,
					},
				},
			},
		},
	}
	_, err := clientSet.CoreV1().Pods(namespace).Create(context.Background(), &pod, metav1.CreateOptions{})
	return err
}
func cleanupPressureTest(clientSet *kubernetes.Clientset, namespace string, selectorLabels labels.Set) {
	foreground := metav1.DeletePropagationForeground
	err := clientSet.CoreV1().Pods(namespace).DeleteCollection(context.Background(), metav1.DeleteOptions{
		PropagationPolicy: &foreground,
	}, metav1.ListOptions{
		LabelSelector: labels.SelectorFromSet(selectorLabels).String(),
	})
	if err != nil {
		log.WithError(err).Debug("error while deleting test pods")
	}
	log.Infof("cleanup done.")
}

func init() {
	testCmd.AddCommand(testSchedulingPressureCmd)

	testSchedulingPressureCmd.Flags().String("namespace", "default", "The namespace the pods are created in")
	testSchedulingPressureCmd.Flags().Float32("size", 0.05, "The size of a single pod (RAM in GB)")
	testSchedulingPressureCmd.Flags().Int("pod-count", 150, "The number of pods to create")
}
