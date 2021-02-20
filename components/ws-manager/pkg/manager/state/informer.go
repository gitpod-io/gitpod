package state

import (
	"fmt"

	"k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/tools/cache"
)

// sharedInformers holds the required SharedIndexInformers that interact with the API server.
type sharedInformers struct {
	ConfigMap cache.SharedIndexInformer
	Service   cache.SharedIndexInformer
	Pod       cache.SharedIndexInformer
}

// Run initiates the synchronization of the informers against the API server.
func (i *sharedInformers) Run(stopCh <-chan struct{}) {
	go i.ConfigMap.Run(stopCh)
	go i.Service.Run(stopCh)
	go i.Pod.Run(stopCh)

	// wait for all involved caches to be synced during startup
	if !cache.WaitForCacheSync(stopCh,
		i.ConfigMap.HasSynced,
		i.Service.HasSynced,
		i.Pod.HasSynced,
	) {
		runtime.HandleError(fmt.Errorf("timed out waiting for caches to sync"))
	}
}
