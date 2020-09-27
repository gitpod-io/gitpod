package dispatch

import (
	"context"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/cri"
	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"

	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
)

const (
	podInformerInitialSyncTimeout = 60 * time.Second
	podInformerResyncInterval     = 30 * time.Second
)

// Workspace represents all the info we have about a workspace
type Workspace struct {
	ContainerID cri.ContainerID
	WorkspaceID string
	InstanceID  string
	Pod         *corev1.Pod
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
func NewDispatch(runtime cri.ContainerRuntimeInterface, kubernetes kubernetes.Interface, k8sNamespace string, listener ...Listener) (*Dispatch, error) {
	d := &Dispatch{
		CRI:                 runtime,
		Kubernetes:          kubernetes,
		KubernetesNamespace: k8sNamespace,
		Listener:            listener,

		ctxs: make(map[string]*workspaceState),
	}

	return d, nil
}

// Dispatch starts tasks when a new workspace appears, and cancels the corresponding
// context when the workspace goes away. If the dispatch is closed, all active contexts
// will be canceled, too.
type Dispatch struct {
	CRI                 cri.ContainerRuntimeInterface
	Kubernetes          kubernetes.Interface
	KubernetesNamespace string

	Listener []Listener

	stopchan chan struct{}
	ctxs     map[string]*workspaceState
	mu       sync.Mutex
}

type workspaceState struct {
	Context   context.Context
	Cancel    context.CancelFunc
	Workspace *Workspace
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
func (d *Dispatch) Close() {
	d.mu.Lock()
	defer d.mu.Unlock()

	close(d.stopchan)
	for _, c := range d.ctxs {
		c.Cancel()
	}
	d.ctxs = make(map[string]*workspaceState)
}

func (d *Dispatch) handlePodAdded(pod *corev1.Pod) {
	workspaceID, ok := pod.Labels[wsk8s.MetaIDLabel]
	if !ok {
		return
	}
	workspaceInstanceID, ok := pod.Labels[wsk8s.WorkspaceIDLabel]
	if !ok {
		return
	}

	waitForPodCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	containerCtx, containerCtxCancel := context.WithCancel(context.Background())
	containerCtx = context.WithValue(containerCtx, contextDispatch, d)
	go func() {
		containerID, err := d.CRI.WaitForContainer(waitForPodCtx, workspaceInstanceID)
		if err != nil && err != context.Canceled {
			log.WithError(err).WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).Warn("cannot wait for container")
		}

		ws := &Workspace{
			ContainerID: containerID,
			InstanceID:  workspaceInstanceID,
			WorkspaceID: workspaceID,
			Pod:         pod,
		}

		d.mu.Lock()
		d.ctxs[pod.Name] = &workspaceState{
			Context:   containerCtx,
			Cancel:    containerCtxCancel,
			Workspace: ws,
		}
		d.mu.Unlock()

		for _, l := range d.Listener {
			l := l
			go func() {
				err := l.WorkspaceAdded(containerCtx, ws)
				if err != nil {
					log.WithError(err).WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).Error("dispatch listener failed")
				}
			}()
		}
	}()
	go func() {
		err := d.CRI.WaitForContainerStop(waitForPodCtx, workspaceInstanceID)
		if err != nil && err != context.Canceled {
			log.WithError(err).WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).Warn("cannot wait for container to be deleted")
		}
		// no matter if the container was deleted or not - we've lost our guard that was waiting for that to happen.
		// Hence, we must stop listening for it to come into existence and cancel the context.
		cancel()
	}()
}

func (d *Dispatch) handlePodUpdate(oldPod, newPod *corev1.Pod) {
	if _, ok := oldPod.Labels[wsk8s.MetaIDLabel]; !ok {
		log.WithField("name", oldPod.Name).Debug("pod has no workspace ID - probably not a workspace. Not dispatching.")
		return
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	state, ok := d.ctxs[oldPod.Name]
	if !ok {
		log.WithFields(wsk8s.GetOWIFromObject(&oldPod.ObjectMeta)).Error("received pod update for a workspace, but have not seen it before. Ignoring update.")
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
	if _, ok := pod.Labels[wsk8s.MetaIDLabel]; !ok {
		log.WithField("name", pod.Name).Debug("pod has no workspace ID - probably not a workspace. Not dispatching.")
		return
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	state, ok := d.ctxs[pod.Name]
	if !ok {
		log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).Error("received pod deletion for a workspace, but have not seen it before. Ignoring update.")
	}

	state.Cancel()
	delete(d.ctxs, pod.Name)
}
