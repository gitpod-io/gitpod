// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package resourcegov

import (
	"context"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/cri"
	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"

	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
)

const (
	kubernetesNamespace            = "k8s.io"
	containerLabelCRIKind          = "io.cri-containerd.kind"
	containerLabelK8sContainerName = "io.kubernetes.container.name"
	containerLabelK8sPodName       = "io.kubernetes.pod.name"
	containerLabelK8sNamespace     = "io.kubernetes.pod.namespace"

	podInformerInitialSyncTimeout = 60 * time.Second
	podInformerResyncInterval     = 30 * time.Second
)

// WorkspaceDispatchConfig configures the containerd resource governer dispatch
type WorkspaceDispatchConfig struct {
	CPUBuckets        []Bucket            `json:"cpuBuckets"`
	ControlPeriod     string              `json:"controlPeriod"`
	SamplingPeriod    string              `json:"samplingPeriod"`
	CGroupsBasePath   string              `json:"cgroupBasePath"`
	ProcessPriorities map[ProcessType]int `json:"processPriorities"`
}

// NewWorkspaceDispatch creates a new container dispatch
func NewWorkspaceDispatch(containerRuntime cri.ContainerRuntimeInterface, kubernetes kubernetes.Interface, kubernetesNamespace string, config WorkspaceDispatchConfig, prom prometheus.Registerer) *WorkspaceDispatch {
	return &WorkspaceDispatch{
		CRI:                 containerRuntime,
		Kubernetes:          kubernetes,
		KubernetesNamespace: kubernetesNamespace,
		Config:              config,
		Prometheus:          prom,
		governer:            make(map[cri.ContainerID]*Governer),
		wsiContainerID:      make(map[string]cri.ContainerID),
		labelCache:          newExpiringCache(30 * time.Second), // we don't expect a container to be created more than 30 seconds after the sandbox
	}
}

// WorkspaceDispatch listens to containerd to dispatch new governer when a new continer startss
type WorkspaceDispatch struct {
	CRI                 cri.ContainerRuntimeInterface
	Kubernetes          kubernetes.Interface
	KubernetesNamespace string
	Config              WorkspaceDispatchConfig
	Prometheus          prometheus.Registerer

	governer       map[cri.ContainerID]*Governer
	wsiContainerID map[string]cri.ContainerID
	mu             sync.RWMutex
	labelCache     *expiringCache
}

// Start stars the container dispatch - this function does not return until the close channel is closed
func (d *WorkspaceDispatch) Start() error {
	d.Prometheus.MustRegister(
		prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Name: "wsman_node_resource_governer_total",
			Help: "Number active workspace resource governer",
		}, func() float64 {
			d.mu.RLock()
			defer d.mu.RUnlock()

			return float64(len(d.governer))
		}),
	)

	ifac := informers.NewSharedInformerFactory(d.Kubernetes, podInformerResyncInterval)
	podInformer := ifac.Core().V1().Pods().Informer()
	podInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			pod, ok := obj.(*corev1.Pod)
			if !ok {
				return
			}

			d.handlePodAdded(pod)
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			oldPod, ok := oldObj.(*corev1.Pod)
			if !ok {
				return
			}
			newPod, ok := newObj.(*corev1.Pod)
			if !ok {
				return
			}

			d.handlePodUpdate(oldPod, newPod)
		},
	})

	stopchan, synchan := make(chan struct{}), make(chan bool)
	go podInformer.Run(stopchan)
	defer close(stopchan)
	go func() {
		synchan <- cache.WaitForCacheSync(stopchan, podInformer.HasSynced)
	}()
	select {
	case <-time.After(podInformerInitialSyncTimeout):
		return xerrors.Errorf("pod informer did not sync in time")
	case ok := <-synchan:
		if !ok {
			return xerrors.Errorf("pod informer did not sync")
		}
	}
	return nil
}

func (d *WorkspaceDispatch) handlePodAdded(pod *corev1.Pod) {
	workspaceID, ok := pod.Labels[wsk8s.MetaIDLabel]
	if !ok {
		log.WithField("name", pod.Name).Debug("pod has no workspace ID - probably not a workspace. Not governing.")
		return
	}
	workspaceInstanceID, ok := pod.Labels[wsk8s.WorkspaceIDLabel]
	if !ok {
		log.WithField("name", pod.Name).Debug("pod has no workspace instance ID - probably not a workspace. Not governing.")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	go func() {
		containerID, err := d.CRI.WaitForContainer(ctx, workspaceInstanceID)
		if err != nil && err != context.Canceled {
			log.WithError(err).WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).Warn("cannot wait for container")
		}

		d.govern(containerID, pod.Name, workspaceID, workspaceInstanceID)
	}()
	go func() {
		err := d.CRI.WaitForContainerStop(ctx, workspaceInstanceID)
		if err != nil && err != context.Canceled {
			log.WithError(err).WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).Warn("cannot wait for container to be deleted")
		}
		// no matter if the container was deleted or not - we've lost our guard that was waiting for that to happen.
		// Hence, we must stop listening for it to come into existence and cancel the context.
		cancel()
	}()
}

func (d *WorkspaceDispatch) handlePodUpdate(oldPod, newPod *corev1.Pod) {
	d.mu.RLock()
	gov, ok := d.governer[d.wsiContainerID[newPod.Labels["workspaceID"]]]
	d.mu.RUnlock()
	if !ok {
		return
	}

	oldCPULimit, newCPULimit := oldPod.Annotations[wsk8s.CPULimitAnnotation], newPod.Annotations[wsk8s.CPULimitAnnotation]
	if oldCPULimit != newCPULimit {
		var scaledLimit int64

		if newCPULimit != "" {
			limit, err := resource.ParseQuantity(newCPULimit)
			if err != nil {
				log.WithError(err).Error("cannot enforce fixed CPU limit")
			}
			// we need to scale from milli jiffie to jiffie - see governer code for details
			scaledLimit = limit.MilliValue() / 10
		}

		gov.SetFixedCPULimit(scaledLimit)
		gov.log.WithField("limit", scaledLimit).Info("set fixed CPU limit for workspace")
	}
}

func (d *WorkspaceDispatch) getGitpodInfoFromLabelCache(podName string) (workspaceID, instanceID, workspaceType string) {
	rl, ok := d.labelCache.Get(podName)
	if !ok {
		return
	}
	labels, ok := rl.(map[string]string)
	if !ok {
		return
	}

	workspaceID = labels[wsk8s.MetaIDLabel]
	instanceID = labels[wsk8s.WorkspaceIDLabel]
	workspaceType = labels["workspaceType"]
	return
}

// govern starts controlling a container
func (d *WorkspaceDispatch) govern(id cri.ContainerID, podName, workspaceID, instanceID string) {
	d.mu.Lock()
	if _, ok := d.governer[id]; ok {
		d.mu.Unlock()
		return
	}
	defer d.mu.Unlock()

	var totalBudget int64
	for _, bkt := range d.Config.CPUBuckets {
		totalBudget += bkt.Budget
	}

	cgroupPath, err := d.CRI.ContainerCGroupPath(context.Background(), id)
	if err != nil {
		log.WithError(err).Error("cannot start governer")
		return
	}

	var cpuLimiter ResourceLimiter = &ClampingBucketLimiter{Buckets: d.Config.CPUBuckets}
	pod, err := d.Kubernetes.CoreV1().Pods(d.KubernetesNamespace).Get(podName, v1.GetOptions{})
	if err != nil {
		log.WithError(err).Warn("cannot find workspace pod - some governance functions might not work properly")
	} else if fixedLimit, ok := pod.Annotations[wsk8s.CPULimitAnnotation]; ok && fixedLimit != "" {
		var scaledLimit int64
		limit, err := resource.ParseQuantity(fixedLimit)
		if err != nil {
			log.WithError(err).WithField("limitReq", fixedLimit).Warn("workspace requested a fixed CPU limit, but we cannot parse the value")
		}
		// we need to scale from milli jiffie to jiffie - see governer code for details
		scaledLimit = limit.MilliValue() / 10
		cpuLimiter = FixedLimiter(scaledLimit)
	}

	log := log.WithFields(log.OWI("", workspaceID, instanceID)).WithField("containerID", id)
	g, err := NewGoverner(string(id), instanceID, cgroupPath,
		WithCGroupBasePath(d.Config.CGroupsBasePath),
		WithCPULimiter(cpuLimiter),
		WithGitpodIDs(workspaceID, instanceID),
		WithPrometheusRegisterer(prometheus.WrapRegistererWith(prometheus.Labels{"instanceId": instanceID}, d.Prometheus)),
		WithProcessPriorities(d.Config.ProcessPriorities),
	)
	if err != nil {
		log.WithError(err).Error("cannot start governer")
		return
	}

	d.governer[id] = g
	d.wsiContainerID[instanceID] = id
	go g.Start()
	log.Info("started new resource governer")
}
