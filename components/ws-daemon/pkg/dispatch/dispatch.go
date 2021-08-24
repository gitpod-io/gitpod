// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dispatch

import (
	"context"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
)

const (
	podInformerInitialSyncTimeout = 60 * time.Second
	podInformerResyncInterval     = 30 * time.Second
)

// Workspace represents all the info we have about a workspace
type Workspace struct {
	ContainerID container.ID
	WorkspaceID string
	InstanceID  string
	Pod         *corev1.Pod
}

// OWI returns the owner/workspace/instance tripple used for logging
func (w Workspace) OWI() logrus.Fields {
	return log.OWI("", w.WorkspaceID, w.InstanceID)
}

// Listener get called when a new workspace appears, or an existing one is updated.
type Listener interface {
	WorkspaceAdded(ctx context.Context, ws *Workspace) error
}

// UpdateListener gets called when a workspace pod is updated
type UpdateListener interface {
	WorkspaceUpdated(ctx context.Context, ws *Workspace) error
}

// NewDispatch starts a new workspace dispatch
func NewDispatch(runtime container.Runtime, kubernetes kubernetes.Interface, k8sNamespace, nodename string, listener ...Listener) (*Dispatch, error) {
	d := &Dispatch{
		Runtime:             runtime,
		Kubernetes:          kubernetes,
		KubernetesNamespace: k8sNamespace,
		Listener:            listener,
		NodeName:            nodename,

		ctxs: make(map[string]*workspaceState),
	}

	return d, nil
}

// Dispatch starts tasks when a new workspace appears, and cancels the corresponding
// context when the workspace goes away. If the dispatch is closed, all active contexts
// will be canceled, too.
type Dispatch struct {
	Runtime             container.Runtime
	Kubernetes          kubernetes.Interface
	KubernetesNamespace string
	NodeName            string

	Listener []Listener

	stopchan chan struct{}
	ctxs     map[string]*workspaceState
	mu       sync.Mutex
}

type workspaceState struct {
	SeenContainer bool
	Context       context.Context
	Cancel        context.CancelFunc
	Workspace     *Workspace
}

type contextKey struct{}

var (
	contextDispatch = contextKey{}
)

// GetFromContext retrieves the issuing dispatch from the listener context
func GetFromContext(ctx context.Context) *Dispatch {
	return ctx.Value(contextDispatch).(*Dispatch)
}

// Start starts the dispatch
func (d *Dispatch) Start() error {
	ifac := informers.NewSharedInformerFactoryWithOptions(d.Kubernetes, podInformerResyncInterval, informers.WithNamespace(d.KubernetesNamespace))
	podInformer := ifac.Core().V1().Pods().Informer()
	podInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
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
		DeleteFunc: func(obj interface{}) {
			pod, ok := obj.(*corev1.Pod)
			if !ok {
				return
			}

			d.handlePodDeleted(pod)
		},
	})

	var synchan chan bool
	d.stopchan, synchan = make(chan struct{}), make(chan bool)
	go podInformer.Run(d.stopchan)
	go func() {
		synchan <- cache.WaitForCacheSync(d.stopchan, podInformer.HasSynced)
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

// Close stops the dispatch and cancels all previously started listener
func (d *Dispatch) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()

	close(d.stopchan)
	for _, state := range d.ctxs {
		if state != nil && state.Cancel != nil {
			state.Cancel()
		}
	}

	d.ctxs = make(map[string]*workspaceState)

	return nil
}

// WorkspaceExistsOnNode returns true if there is a workspace pod on this node and this
// dispatch knows about it.
func (d *Dispatch) WorkspaceExistsOnNode(instanceID string) (ok bool) {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, ok = d.ctxs[instanceID]
	return
}

func (d *Dispatch) handlePodUpdate(oldPod, newPod *corev1.Pod) {
	workspaceID, ok := newPod.Labels[wsk8s.MetaIDLabel]
	if !ok {
		return
	}
	workspaceInstanceID, ok := newPod.Labels[wsk8s.WorkspaceIDLabel]
	if !ok {
		return
	}
	if d.NodeName != "" && newPod.Spec.NodeName != d.NodeName {
		return
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	state, ok := d.ctxs[workspaceInstanceID]
	if !ok {
		// we haven't seen this pod before - add it, and wait for the container
		owi := wsk8s.GetOWIFromObject(&newPod.ObjectMeta)
		d.ctxs[workspaceInstanceID] = &workspaceState{
			SeenContainer: false,
			Workspace: &Workspace{
				InstanceID:  workspaceInstanceID,
				WorkspaceID: workspaceID,
				Pod:         newPod,
			},
		}

		waitForPodCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		containerCtx, containerCtxCancel := context.WithCancel(context.Background())
		containerCtx = context.WithValue(containerCtx, contextDispatch, d)
		go func() {
			containerID, err := d.Runtime.WaitForContainer(waitForPodCtx, workspaceInstanceID)
			if err != nil && err != context.Canceled {
				log.WithError(err).WithFields(owi).Warn("cannot wait for container")
			}
			log.WithFields(owi).WithField("container", containerID).Info("dispatch found new workspace container")

			d.mu.Lock()
			s := d.ctxs[workspaceInstanceID]
			if s == nil {
				log.WithFields(owi).Error("pod disappaered from dispatch state before container was ready")
				d.mu.Unlock()
				return
			}
			s.Context = containerCtx
			s.Cancel = containerCtxCancel
			s.Workspace.ContainerID = containerID
			s.SeenContainer = true
			d.mu.Unlock()

			for _, l := range d.Listener {
				l := l
				go func() {
					err := l.WorkspaceAdded(containerCtx, s.Workspace)
					if err != nil {
						log.WithError(err).WithFields(owi).Error("dispatch listener failed")
					}
				}()
			}
		}()
		go func() {
			// no matter if the container was deleted or not - we've lost our guard that was waiting for that to happen.
			// Hence, we must stop listening for it to come into existence and cancel the context.
			err := d.Runtime.WaitForContainerStop(waitForPodCtx, workspaceInstanceID)
			if err != nil {
				log.WithError(err).WithFields(owi).Error("unexpected waiting for container to stop")
			}

			cancel()
		}()

		return
	}

	if !state.SeenContainer {
		return
	}

	state.Workspace.Pod = newPod

	for _, l := range d.Listener {
		lu, ok := l.(UpdateListener)
		if !ok {
			continue
		}

		go func() {
			err := lu.WorkspaceUpdated(state.Context, state.Workspace)
			if err != nil {
				log.WithError(err).WithFields(wsk8s.GetOWIFromObject(&oldPod.ObjectMeta)).Error("dispatch listener failed")
			}
		}()
	}
}

func (d *Dispatch) handlePodDeleted(pod *corev1.Pod) {
	instanceID, ok := pod.Labels[wsk8s.WorkspaceIDLabel]
	if !ok {
		return
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	state, ok := d.ctxs[instanceID]
	if !ok {
		log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).Debug("received pod deletion for a workspace, but have not seen it before. Probably another node. Ignoring update.")
		return
	}
	if state.Cancel != nil {
		state.Cancel()
	}
	delete(d.ctxs, instanceID)
}
