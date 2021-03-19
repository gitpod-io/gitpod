// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package poolkeeper

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"

	log "github.com/sirupsen/logrus"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	types "k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
)

// PatchDeploymentAffinity applies a NodeAffinity to all deployments of a namespace
type PatchDeploymentAffinity struct {
	// Namespace specifies which namespace's deployments should be patched
	Namespace string `json:"namespace"`

	// NodeAffinity is applied to all specified deployments
	NodeAffinity *corev1.NodeAffinity `json:"nodeAffinity"`
}

func (pa *PatchDeploymentAffinity) run(clientset *kubernetes.Clientset) {
	deploymentsList, err := clientset.AppsV1().Deployments(pa.Namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.WithError(err).Error("unable to list deployments")
		return
	}
	var deploymentsToPatch []*appsv1.Deployment
	for _, dep := range deploymentsList.Items {
		deployment := dep
		affinity := deployment.Spec.Template.Spec.Affinity
		if affinity == nil || !reflect.DeepEqual(affinity.NodeAffinity, pa.NodeAffinity) {
			deploymentsToPatch = append(deploymentsToPatch, &deployment)
		}
	}
	log.WithField("namespace", pa.Namespace).Debugf("found %d deployments to patch", len(deploymentsToPatch))

	nodeAffinityBytes, err := json.Marshal(pa.NodeAffinity)
	if err != nil {
		log.WithError(err).Error("error marshalling NodeAffinity")
		return
	}
	patch := fmt.Sprintf(`{"spec": { "template": { "spec": { "affinity": { "nodeAffinity": %s}}}}}`, string(nodeAffinityBytes))
	// log.Debugf("patch: %s", patch)

	appsv1 := clientset.AppsV1()
	for _, deployment := range deploymentsToPatch {
		_, err := appsv1.Deployments(pa.Namespace).Patch(context.Background(), deployment.Name, types.MergePatchType, []byte(patch), metav1.PatchOptions{})
		if err != nil {
			log.WithField("namespace", pa.Namespace).WithField("deployment", deployment.Name).WithError(err).Error("error patching deployment")
			continue
		}
	}
}
