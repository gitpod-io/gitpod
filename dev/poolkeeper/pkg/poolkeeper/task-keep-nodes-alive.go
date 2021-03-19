// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package poolkeeper

import (
	"context"
	"fmt"
	"time"

	log "github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

const (
	keepNodeAliveMarkerLabel = "poolkeeper/keepNodeAliveMarkerLabel"
)

// KeepNodeAlive tries to avoid downscaling for a node for the specified period of day
type KeepNodeAlive struct {
	// Namespace to create the keep-alive pod in
	Namespace string `json:"namespace,omitempty"`

	// NodeSelector specifies which nodes should be kept alive
	NodeSelector map[string]string `json:"nodeSelector"`

	// PeriodStart since to try to keep the node alive
	PeriodStart TimeOfDay `json:"periodStart"`

	// PeriodEnd until when to try to keep the node alive
	PeriodEnd TimeOfDay `json:"periodEnd"`
}

func (k *KeepNodeAlive) run(clientset *kubernetes.Clientset, t time.Time) {
	podList, err := clientset.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=true", keepNodeAliveMarkerLabel),
	})
	if err != nil {
		log.WithError(err).Error("unable to list pods")
		return
	}
	currentKeepAlivePods := podList.Items
	log.Debugf("found %d current keep-alive pods", len(currentKeepAlivePods))

	namespace := k.Namespace
	if namespace == "" {
		namespace = "default"
	}

	t = t.Local()
	tod := time.Date(0, 1, 1, t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), t.Location())
	start := time.Time(k.PeriodStart)
	end := time.Time(k.PeriodEnd)
	if tod.Before(start) {
		log.Debug("nothing to do")
		return
	} else if tod.After(start) && tod.Before(end) {
		if len(currentKeepAlivePods) > 0 {
			log.WithField("pod", currentKeepAlivePods[0].Name).Info("found keep alive pod, nothing to do.")
			return
		}

		uid1000 := int64(1000)
		v1 := clientset.CoreV1()
		pod, err := v1.Pods(namespace).Create(context.Background(), &corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name: "poolkeeper-keep-alive",
				Labels: map[string]string{
					keepNodeAliveMarkerLabel: "true",
				},
			},
			Spec: corev1.PodSpec{
				Containers: []corev1.Container{
					{
						Name:    "keepalive",
						Image:   "bash:latest",
						Command: []string{"bash", "-c", "while true; do sleep 600; done"},
						SecurityContext: &corev1.SecurityContext{
							RunAsUser: &uid1000,
						},
					},
				},
				NodeSelector: k.NodeSelector,
			},
		}, metav1.CreateOptions{})
		if err != nil {
			log.WithError(err).Errorf("error creating keep-alive pod")
			return
		}
		log.WithField("pod", pod.Name).Info("created pod")
	} else if tod.After(end) {
		if len(currentKeepAlivePods) > 0 {
			v1 := clientset.CoreV1()
			background := metav1.DeletePropagationBackground
			for _, pod := range currentKeepAlivePods {
				err := v1.Pods(namespace).Delete(context.Background(), pod.Name, metav1.DeleteOptions{PropagationPolicy: &background})
				if err != nil {
					log.WithError(err).Errorf("error deleting keep-alive pod")
					continue
				}
				log.WithField("pod", pod.Name).Info("deleted pod")
			}
		}
	}
}
