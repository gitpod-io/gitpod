package manager

import (
	"context"
	"fmt"
	"net/http"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"

	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	k8serr "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
)

type workspaceObjectCache struct {
	podIdx        cache.Indexer
	podCtrl       cache.Controller
	serviceIdx    cache.Indexer
	serviceCtrl   cache.Controller
	configMapIdx  cache.Indexer
	configMapCtrl cache.Controller

	stop chan struct{}
}

const (
	indexerInstanceID = "gitpod/instanceID"
)

func newWorkspaceObjectCache(clientset kubernetes.Interface, namespace string) *workspaceObjectCache {
	res := &workspaceObjectCache{
		podIdx: cache.NewIndexer(cache.MetaNamespaceKeyFunc, cache.Indexers{
			indexerInstanceID: metaInstanceIDIndexer,
		}),
		serviceIdx:   cache.NewIndexer(cache.MetaNamespaceKeyFunc, cache.Indexers{}),
		configMapIdx: cache.NewIndexer(cache.MetaNamespaceKeyFunc, cache.Indexers{}),

		stop: make(chan struct{}),
	}

	wsLabelSelector := workspaceObjectListOptions().LabelSelector

	podLW := cache.NewFilteredListWatchFromClient(clientset.CoreV1().RESTClient(), "pods", namespace, func(options *metav1.ListOptions) {
		options.LabelSelector = wsLabelSelector
	})
	res.podIdx, res.podCtrl = cache.NewIndexerInformer(podLW, &corev1.Pod{}, 0, cache.ResourceEventHandlerFuncs{}, cache.Indexers{
		indexerInstanceID: metaInstanceIDIndexer,
	})
	res.podCtrl.Run(res.stop)

	serviceLW := cache.NewFilteredListWatchFromClient(clientset.CoreV1().RESTClient(), "services", namespace, func(options *metav1.ListOptions) {
		options.LabelSelector = wsLabelSelector
	})
	res.serviceIdx, res.serviceCtrl = cache.NewIndexerInformer(serviceLW, &corev1.Service{}, 0, cache.ResourceEventHandlerFuncs{}, cache.Indexers{})
	res.serviceCtrl.Run(res.stop)

	cfgmapLW := cache.NewFilteredListWatchFromClient(clientset.CoreV1().RESTClient(), "configMaps", namespace, func(options *metav1.ListOptions) {
		options.LabelSelector = wsLabelSelector
	})
	res.configMapIdx, res.configMapCtrl = cache.NewIndexerInformer(cfgmapLW, &corev1.ConfigMap{}, 0, cache.ResourceEventHandlerFuncs{}, cache.Indexers{})
	res.configMapCtrl.Run(res.stop)

	return res
}

func metaInstanceIDIndexer(obj interface{}) ([]string, error) {
	meta, err := meta.Accessor(obj)
	if err != nil {
		return []string{""}, xerrors.Errorf("object has no meta: %w", err)
	}

	lbls := meta.GetLabels()
	return []string{lbls[wsk8s.WorkspaceIDLabel]}, nil
}

func serviceInstanceIDIndexKey(instanceID, serviceType string) string {
	return instanceID + "/" + serviceType
}

// HasSynced returns true if all indexes have synced
func (c *workspaceObjectCache) WaitForCacheSync() (ok bool) {
	return cache.WaitForCacheSync(c.stop, c.configMapCtrl.HasSynced, c.podCtrl.HasSynced, c.serviceCtrl.HasSynced)
}

func (c *workspaceObjectCache) getIndex(obj runtime.Object) (idx cache.Indexer) {
	switch obj.(type) {
	case *corev1.Pod:
		idx = c.podIdx
	case *corev1.Service:
		idx = c.serviceIdx
	case *corev1.ConfigMap:
		idx = c.configMapIdx
	}
	return
}

// GetAllWorkspaceObjects retturns all (possibly incomplete) workspaceObjects of all workspaces this manager is currently aware of.
// If a workspace has a pod that pod is part of the returned WSO.
// If a workspace has a PLIS that PLIS is part of the returned WSO.
func (c *workspaceObjectCache) GetAllWorkspaceObjects(ctx context.Context) (result []workspaceObjects, err error) {
	//nolint:ineffassign
	span, ctx := tracing.FromContext(ctx, "GetAllWorkspaceObjects")
	defer tracing.FinishSpan(span, &err)

	var wsoIndex = make(map[string]*workspaceObjects)
	for _, k := range c.podIdx.ListKeys() {
		p, ok, _ := c.podIdx.GetByKey(k)
		if !ok {
			continue
		}
		pod := p.(*corev1.Pod)

		id, ok := pod.Annotations[workspaceIDAnnotation]
		if !ok {
			log.WithField("pod", pod.Name).Warn("pod has no workspace ID")
			span.LogKV("warning", "pod has no workspace ID", "podName", pod.Name)
			span.SetTag("error", true)
			continue
		}

		wso, err := c.GetWorkspaceObjects(ctx, pod)
		if err != nil {
			log.WithField("pod", pod.Name).WithError(err).Warn("cannot complete workspace objects")
			tracing.LogError(span, err)
			continue
		}

		wsoIndex[id] = wso
	}
	for _, k := range c.configMapIdx.ListKeys() {
		p, ok, _ := c.configMapIdx.GetByKey(k)
		if !ok {
			continue
		}
		plis := p.(*corev1.ConfigMap)

		id, ok := plis.Annotations[workspaceIDAnnotation]
		if !ok {
			log.WithField("plis", plis.Name).Warn("PLIS has no workspace ID")
			span.LogKV("warning", "PLIS has no workspace ID", "podName", plis.Name)
			span.SetTag("error", true)
			continue
		}

		wso := &workspaceObjects{PLIS: plis}
		err := c.CompleteWorkspaceObjects(ctx, wso)

		if err != nil {
			log.WithField("instanceId", k).WithError(err).Warn("cannot complete workspace objects")
			tracing.LogError(span, err)
			continue
		}

		wsoIndex[id] = wso
	}

	result = make([]workspaceObjects, 0, len(wsoIndex))
	for _, wso := range wsoIndex {
		result = append(result, *wso)
	}
	return result, nil
}

func (c *workspaceObjectCache) FindWorkspacePod(instanceID string) (*corev1.Pod, error) {
	p, err := c.podIdx.ByIndex("gitpod/instanceID", instanceID)
	if err != nil {
		return nil, err
	}
	if len(p) == 0 {
		// return kubernetes error to remain compatible with previous means of finding the
		// workspace pod.
		return nil, &k8serr.StatusError{ErrStatus: metav1.Status{
			Code:    http.StatusNotFound,
			Message: fmt.Sprintf("pod for workspace %s not found", instanceID),
		}}
	}
	return p[0].(*corev1.Pod), nil
}

func (c *workspaceObjectCache) GetWorkspaceObjects(ctx context.Context, pod *corev1.Pod) (*workspaceObjects, error) {
	wso := &workspaceObjects{Pod: pod}
	err := c.CompleteWorkspaceObjects(ctx, wso)
	if err != nil {
		return nil, xerrors.Errorf("getWorkspaceObjects: %w", err)
	}
	return wso, nil
}

// completeWorkspaceObjects finds the remaining Kubernetes objects based on the pod description
// or pod lifecycle indepedent state.
func (c *workspaceObjectCache) CompleteWorkspaceObjects(ctx context.Context, wso *workspaceObjects) error {
	if wso.Pod == nil && wso.PLIS == nil {
		return xerrors.Errorf("completeWorkspaceObjects: need either pod or lifecycle independent state")
	}

	// find pod if we're working on PLIS alone so far
	if wso.Pod == nil {
		instanceID, ok := wso.PLIS.ObjectMeta.Annotations[workspaceIDAnnotation]
		if !ok {
			return xerrors.Errorf("cannot find %s annotation on %s", workspaceIDAnnotation, wso.PLIS.Name)
		}

		pod, err := c.FindWorkspacePod(instanceID)
		if err == nil {
			wso.Pod = pod
		}

		if !isKubernetesObjNotFoundError(err) && err != nil {
			return xerrors.Errorf("completeWorkspaceObjects: %w", err)
		}
	}

	// find our service prefix to see if the services still exist
	servicePrefix := ""
	if wso.Pod != nil {
		servicePrefix = wso.Pod.Annotations[servicePrefixAnnotation]
	}
	if servicePrefix == "" && wso.PLIS != nil {
		servicePrefix = wso.PLIS.Annotations[servicePrefixAnnotation]
	}
	if servicePrefix == "" {
		return xerrors.Errorf("completeWorkspaceObjects: no service prefix found")
	}
	if wso.TheiaService == nil {
		s, ok, err := c.serviceIdx.GetByKey(getTheiaServiceName(servicePrefix))
		if err != nil {
			return xerrors.Errorf("completeWorkspaceObjects: %w", err)
		}
		if ok {
			wso.TheiaService = s.(*corev1.Service)
		}
	}
	if wso.PortsService == nil {
		s, ok, err := c.serviceIdx.GetByKey(getPortsServiceName(servicePrefix))
		if err != nil {
			return xerrors.Errorf("completeWorkspaceObjects: %w", err)
		}
		if ok {
			wso.TheiaService = s.(*corev1.Service)
		}
	}

	// find pod events - this only makes sense if we still have a pod
	// if wso.Pod != nil {
	// 	if wso.Events == nil && wso.Pod != nil {
	// 		events, err := m.Clientset.CoreV1().Events(m.Config.Namespace).Search(scheme, wso.Pod)
	// 		if err != nil {
	// 			return xerrors.Errorf("completeWorkspaceObjects: %w", err)
	// 		}

	// 		wso.Events = make([]corev1.Event, len(events.Items))
	// 		copy(wso.Events, events.Items)
	// 	}
	// }

	// if we don't have PLIS but a pod, try and find the PLIS
	if wso.PLIS == nil {
		workspaceID, ok := wso.Pod.Annotations[workspaceIDAnnotation]
		if !ok {
			return fmt.Errorf("cannot act on pod %s: has no %s annotation", wso.Pod.Name, workspaceIDAnnotation)
		}

		s, ok, err := c.configMapIdx.GetByKey(getPodLifecycleIndependentCfgMapName(workspaceID))
		if err != nil {
			return xerrors.Errorf("completeWorkspaceObjects: %w", err)
		}
		if ok {
			wso.PLIS = s.(*corev1.ConfigMap)
		}
	}

	return nil
}
