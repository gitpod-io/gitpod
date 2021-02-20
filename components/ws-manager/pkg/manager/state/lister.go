package state

import (
	"fmt"
	"net/http"

	apiv1 "k8s.io/api/core/v1"
	k8serr "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"
)

// listers is an object storage for Kubernetes objects used in the ws-manager
type listers struct {
	ConfigMap configMapLister
	Service   serviceLister
	Pod       podLister
}

type configMapLister struct {
	cache.Store
}

// ByKey returns the ConfigMap matching key in the ConfigMap Store.
func (cml *configMapLister) ByKey(key string) (*apiv1.ConfigMap, error) {
	s, exists, err := cml.GetByKey(key)
	if err != nil {
		return nil, err
	}

	if !exists {
		return nil, &k8serr.StatusError{ErrStatus: metav1.Status{
			Code:    http.StatusNotFound,
			Message: fmt.Sprintf("cannot find configmap %s", key),
		}}
	}

	return s.(*apiv1.ConfigMap), nil
}

type podLister struct {
	cache.Store
}

// ByKey returns the Pod matching key in the Pod Store.
func (pl *podLister) ByKey(key string) (*apiv1.Pod, error) {
	s, exists, err := pl.GetByKey(key)
	if err != nil {
		return nil, err
	}

	if !exists {
		return nil, &k8serr.StatusError{ErrStatus: metav1.Status{
			Code:    http.StatusNotFound,
			Message: fmt.Sprintf("cannot find pod %s", key),
		}}
	}

	return s.(*apiv1.Pod), nil
}

type serviceLister struct {
	cache.Store
}

// ByKey returns the Service matching key in the Service Store.
func (pl *serviceLister) ByKey(key string) (*apiv1.Service, error) {
	s, exists, err := pl.GetByKey(key)
	if err != nil {
		return nil, err
	}

	if !exists {
		return nil, &k8serr.StatusError{ErrStatus: metav1.Status{
			Code:    http.StatusNotFound,
			Message: fmt.Sprintf("cannot find service %s", key),
		}}
	}

	return s.(*apiv1.Service), nil
}
