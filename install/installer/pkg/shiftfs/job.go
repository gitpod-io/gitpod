// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package shiftfs

import (
	"context"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	k8s "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
	"k8s.io/utils/pointer"
)

// Container defined the actual container for the resource
func Container(ctx *common.RenderContext) v1.Container {
	return v1.Container{
		Name:  Component,
		Image: ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.WSDaemon.UserNamespaces.ShiftFSModuleLoader.Version),
		SecurityContext: &v1.SecurityContext{
			Privileged: pointer.Bool(true),
		},
		VolumeMounts: []corev1.VolumeMount{
			{
				Name:      "node-linux-src",
				ReadOnly:  true,
				MountPath: "/usr/src_node",
			},
		},
	}
}

// IsSupported deploys the ShiftFS job to the cluster - if it runs to completion, ShiftFS is supported
func IsSupported(gitpodCtx *common.RenderContext, serviceAccountName string, clientset *k8s.Clientset, timeout time.Duration) (*bool, error) {
	supported := false
	k8sCtx := context.TODO()

	// Generate the ShiftFS job
	job, err := job(gitpodCtx, serviceAccountName, timeout)
	if err != nil {
		return nil, err
	}

	jobClient := clientset.BatchV1().Jobs(gitpodCtx.Namespace)

	// List all currently deployed jobs
	jobList, err := jobClient.List(k8sCtx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	for _, j := range jobList.Items {
		// If the job already exists, delete it
		if j.Name == job.Name {
			deletePolicy := metav1.DeletePropagationForeground
			if err := jobClient.Delete(k8sCtx, j.Name, metav1.DeleteOptions{
				PropagationPolicy: &deletePolicy,
			}); err != nil {
				return nil, err
			}
		}
	}

	// Deploy the job to the cluster
	_, err = jobClient.Create(k8sCtx, job, metav1.CreateOptions{})
	if err != nil {
		return nil, err
	}

	timeoutCtx, cancel := context.WithTimeout(k8sCtx, timeout)

	// Now we wait for the job to either complete successfully or fail
	watchList := cache.NewListWatchFromClient(
		clientset.BatchV1().RESTClient(),
		"jobs",
		gitpodCtx.Namespace,
		fields.OneTermEqualSelector("metadata.name", job.Name),
	)
	_, controller := cache.NewInformer(
		watchList,
		&batchv1.Job{},
		0,
		cache.ResourceEventHandlerFuncs{
			UpdateFunc: func(_, job interface{}) {
				if job.(*batchv1.Job).Status.Succeeded > 0 {
					// ShiftFS is supported - exit the loop
					cancel()
					supported = true
				}
			},
		},
	)

	stop := make(chan struct{})
	defer func() {
		log.Info("Deleting cluster resources")
		close(stop)
	}()
	go controller.Run(stop)

	<-timeoutCtx.Done()
	return pointer.Bool(supported), nil
}

// job is a standalone job which does **NOT** conform to the CompositeRenderFunc format
func job(ctx *common.RenderContext, serviceAccountName string, timeout time.Duration) (*batchv1.Job, error) {
	objectMeta := metav1.ObjectMeta{
		Name:      Component,
		Namespace: ctx.Namespace,
		Labels:    common.DefaultLabels(Component),
	}

	return &batchv1.Job{
		TypeMeta:   common.TypeMetaBatchJob,
		ObjectMeta: objectMeta,
		Spec: batchv1.JobSpec{
			TTLSecondsAfterFinished: pointer.Int32(60),
			ActiveDeadlineSeconds:   pointer.Int64(int64(timeout / time.Second)),
			BackoffLimit:            pointer.Int32(1),
			Parallelism:             pointer.Int32(1),
			Template: v1.PodTemplateSpec{
				ObjectMeta: objectMeta,
				Spec: v1.PodSpec{
					Affinity:           common.NodeAffinity(cluster.AffinityLabelWorkspacesRegular, cluster.AffinityLabelWorkspacesHeadless),
					ServiceAccountName: serviceAccountName,
					RestartPolicy:      v1.RestartPolicyNever,
					Containers: []v1.Container{
						Container(ctx),
					},
					Volumes: []v1.Volume{
						{
							Name: "node-linux-src",
							VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
								Path: "/usr/src",
								Type: func() *corev1.HostPathType {
									r := corev1.HostPathDirectory
									return &r
								}(),
							}},
						},
					},
				},
			},
		},
	}, nil
}
