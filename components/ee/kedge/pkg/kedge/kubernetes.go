// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package kedge

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"k8s.io/client-go/tools/clientcmd"
)

const (
	// kedgeLegacyLabelSelector is the old label selector that kedge used to mark Kubernetes objects
	kedgeLegacyLabelSelector = "kedge=replicated"

	// LabelKedge is the label we apply to Kubernetes objects to mark them as created by/belonging to kedge.
	LabelKedge = "gitpod.io/Kedge"
	// LabelSource is the label we apply to Kubernetes objects to store the source of an object
	LabelSource = "gitpod.io/KedgeSrc"

	kedgeLabelSelector = LabelKedge + "=true"
)

var (
	defaultPropagationPolicy   = metav1.DeletePropagationForeground
	defaultDeletionGracePeriod = int64(10)
)

// NewClientSet creates a new Kubernetes client set from either in-cluster config (empty kubeconfig) or
// some kubeconfig file.
func NewClientSet(kubeconfig string) (kubernetes.Interface, error) {
	if kubeconfig == "" {
		k8s, err := rest.InClusterConfig()
		if err != nil {
			return nil, err
		}
		return kubernetes.NewForConfig(k8s)
	}

	res, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		return nil, err
	}
	return kubernetes.NewForConfig(res)
}

// Discover extracts a set of services from a Kubernetes namespace
func Discover(clientset kubernetes.Interface, namespace string, services []string) ([]Service, error) {
	log.WithField("services", services).Debug("discovering Kubernetes services")

	api := clientset.CoreV1()
	existingServiceList, err := api.Services(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, xerrors.Errorf("cannot get services: %w", err)
	}
	existingServiceIdx := make(map[string]corev1.Service)
	for _, s := range existingServiceList.Items {
		existingServiceIdx[s.Name] = s
	}
	endpoints, err := api.Endpoints(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, xerrors.Errorf("cannot get endpoints: %w", err)
	}
	endpointIdx := make(map[string]corev1.Endpoints)
	for _, e := range endpoints.Items {
		endpointIdx[e.Name] = e
	}

	var result []Service
	for _, sn := range services {
		service, exists := existingServiceIdx[sn]
		if !exists {
			log.WithField("name", sn).Warn("did not find service")
			continue
		}
		endpoint, exists := endpointIdx[sn]
		if !exists {
			log.WithField("name", sn).Warn("service has no endpoints")
			continue
		}

		result = append(result, Service{
			Service:  &service,
			Endpoint: &endpoint,
		})
	}
	return result, nil
}

// Install installs a set of services in a Kubernetes cluster
func Install(clientset kubernetes.Interface, namespace string, source string, services []Service, namer Namer) (newServices []string, err error) {
	api := clientset.CoreV1()
	serviceList, err := api.Services(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, xerrors.Errorf("cannot get services: %w", err)
	}
	serviceIdx := make(map[string]corev1.Service)
	for _, s := range serviceList.Items {
		serviceIdx[s.Name] = s
	}

	var res []string
	for _, srv := range services {
		serviceName := namer(srv.Service.Name)
		service, exists := serviceIdx[serviceName]
		if exists {
			if _, ok := service.Labels[LabelKedge]; !ok {
				log.WithField("name", serviceName).WithField("namespace", namespace).Warn("service already exists but was not created by kedge - not installing endpoints")
				continue
			}
		} else {
			if err := createTargetService(clientset, namespace, source, serviceName, srv); err != nil {
				return nil, xerrors.Errorf("cannot create target service: %w", err)
			}
			log.WithField("src", srv.Service.Name).WithField("dst", serviceName).Debug("created service")
			res = append(res, serviceName)
		}

		shouldCreateEndpoint, err := clearTargetEndpoints(clientset, namespace, serviceName, srv)
		if err != nil {
			return nil, xerrors.Errorf("cannot clear target endpoints: %w", err)
		}
		if shouldCreateEndpoint {
			err := createTargetEndpoints(clientset, namespace, source, serviceName, srv)
			if err != nil {
				return nil, xerrors.Errorf("cannot create target endooints: %w", err)
			}
			log.WithField("src", srv.Service.Name).WithField("dst", serviceName).Debug("created endpoints")
		}
	}

	return res, nil
}

// ErrDeletionFailed is returned by ClearServices when deleting a service or endpoint fails
var ErrDeletionFailed = errors.New("deletion failed")

// ClearLegacyServices removes all services and endpoints which bear the old kedge label
func ClearLegacyServices(clientset kubernetes.Interface, namespace string) (err error) {
	servicesAPI := clientset.CoreV1().Services(namespace)
	services, err := servicesAPI.List(context.Background(), metav1.ListOptions{LabelSelector: kedgeLegacyLabelSelector})
	if err != nil {
		return xerrors.Errorf("cannot get services: %w", err)
	}
	for _, s := range services.Items {
		err = servicesAPI.Delete(context.Background(), s.Name, metav1.DeleteOptions{
			GracePeriodSeconds: &defaultDeletionGracePeriod,
			PropagationPolicy:  &defaultPropagationPolicy,
		})
		if err != nil {
			log.WithError(err).WithField("name", s.Name).Warn("cannot delete service")
			err = ErrDeletionFailed
			// do not return here and attempt to delete the other services/endpoints
		}
	}

	endpointsAPI := clientset.CoreV1().Endpoints(namespace)
	endpoints, err := endpointsAPI.List(context.Background(), metav1.ListOptions{LabelSelector: kedgeLegacyLabelSelector})
	if err != nil {
		return xerrors.Errorf("cannot get endpoints: %w", err)
	}
	for _, e := range endpoints.Items {
		err = endpointsAPI.Delete(context.Background(), e.Name, metav1.DeleteOptions{
			GracePeriodSeconds: &defaultDeletionGracePeriod,
			PropagationPolicy:  &defaultPropagationPolicy,
		})
		if err != nil {
			log.WithError(err).WithField("name", e.Name).Warn("cannot delete endpoint")
			err = ErrDeletionFailed
			// do not return here and attempt to delete the other endpoints
		}
	}

	return
}

// ClearServices removes all services from a single source.
func ClearServices(clientset kubernetes.Interface, namespace, source string) (err error) {
	servicesAPI := clientset.CoreV1().Services(namespace)
	services, err := servicesAPI.List(context.Background(), metav1.ListOptions{LabelSelector: fmt.Sprintf("%s=%s", LabelSource, source)})
	if err != nil {
		return xerrors.Errorf("cannot get services: %w", err)
	}
	for _, s := range services.Items {
		err = servicesAPI.Delete(context.Background(), s.Name, metav1.DeleteOptions{
			GracePeriodSeconds: &defaultDeletionGracePeriod,
			PropagationPolicy:  &defaultPropagationPolicy,
		})
		if err != nil {
			log.WithError(err).WithField("name", s.Name).Warn("cannot delete service")
			err = ErrDeletionFailed
			// do not return here and attempt to delete the other services/endpoints
		}
	}

	endpointsAPI := clientset.CoreV1().Endpoints(namespace)
	endpoints, err := endpointsAPI.List(context.Background(), metav1.ListOptions{LabelSelector: fmt.Sprintf("%s=%s", LabelSource, source)})
	if err != nil {
		return xerrors.Errorf("cannot get endpoints: %w", err)
	}
	for _, e := range endpoints.Items {
		err = endpointsAPI.Delete(context.Background(), e.Name, metav1.DeleteOptions{
			GracePeriodSeconds: &defaultDeletionGracePeriod,
			PropagationPolicy:  &defaultPropagationPolicy,
		})
		if err != nil {
			log.WithError(err).WithField("name", e.Name).Warn("cannot delete endpoint")
			err = ErrDeletionFailed
			// do not return here and attempt to delete the other endpoints
		}
	}

	return
}

func createTargetService(clientset kubernetes.Interface, namespace, source, name string, srv Service) error {
	api := clientset.CoreV1()

	ports := make([]corev1.ServicePort, 0)
	for _, p := range srv.Service.Spec.Ports {
		ports = append(ports, corev1.ServicePort{
			Name:     p.Name,
			Port:     p.Port,
			Protocol: p.Protocol,
		})
	}

	targetService := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels:    addKedgeLabels(srv.Service.Labels, source),
		},
		Spec: corev1.ServiceSpec{
			Type:            corev1.ServiceTypeClusterIP,
			Ports:           ports,
			SessionAffinity: srv.Service.Spec.SessionAffinity,
		},
	}

	// 'app.kubernetes.io/instance' is automatically added to kedge when it is deployed by ArgoCD.
	// This mechanism is used so ArgoCD knows which resource it is supposed to control and which ones it isn't.
	// If we add this label to the resources created by kedge, ArgoCD will think that ArgoCD should be controlled,
	// and since their resource definitions are not in git, ArgoCD will try to delete them.
	labels := targetService.GetLabels()
	delete(labels, "app.kubernetes.io/instance")
	targetService.SetLabels(labels)

	_, err := api.Services(namespace).Create(context.Background(), targetService, metav1.CreateOptions{})
	if err != nil {
		return xerrors.Errorf("cannot create target service: %w", err)
	}
	return nil
}

func clearTargetEndpoints(clientset kubernetes.Interface, namespace string, name string, srv Service) (bool, error) {
	api := clientset.CoreV1().Endpoints(namespace)
	endpoints, err := api.List(context.Background(), metav1.ListOptions{LabelSelector: kedgeLabelSelector})
	if err != nil {
		return false, xerrors.Errorf("cannot get endpoints: %w", err)
	}

	found := false
	var existingEndpoint corev1.Endpoints
	for _, ep := range endpoints.Items {
		if ep.Name == name {
			existingEndpoint = ep
			found = true
			break
		}
	}
	if !found {
		return true, nil
	}

	// Clear out differences that don't matter
	for i, s := range srv.Endpoint.Subsets {
		for j := range s.Addresses {
			srv.Endpoint.Subsets[i].Addresses[j].NodeName = nil
			srv.Endpoint.Subsets[i].Addresses[j].TargetRef = nil
		}
	}

	if !reflect.DeepEqual(existingEndpoint.Subsets, srv.Endpoint.Subsets) {
		log.WithField("name", name).Debug("endpoint subsets are not equal to each other - deleting")
	} else {
		// endpoint subsets are equal to each other - NOT deleting
		return false, nil
	}

	err = api.Delete(context.Background(), name, metav1.DeleteOptions{PropagationPolicy: &defaultPropagationPolicy})
	if err != nil {
		return false, xerrors.Errorf("cannot delete existing endpoint: %w", err)
	}
	log.WithField("name", name).WithField("namespace", namespace).Debug("deleted previous endpoint")

	ticker := time.NewTicker(200 * time.Millisecond)
	done := make(chan bool, 1)
	go func() {
		for {
			endpoints, err := api.List(context.Background(), metav1.ListOptions{LabelSelector: kedgeLabelSelector})
			if err != nil {
				log.WithError(err).Warn("error while listing service endpoints")
				continue
			}

			found := false
			for _, ep := range endpoints.Items {
				if ep.Name == name {
					found = true
					break
				}
			}

			if !found {
				// endpoint is actually gone which means we're done here
				done <- true
				return
			}
			<-ticker.C
		}
	}()

	select {
	case <-done:
		return true, nil
	case <-time.After(120 * time.Second):
		return false, xerrors.Errorf("timeout while waiting for the endpoints to be deleted")
	}
}

func createTargetEndpoints(clientset kubernetes.Interface, namespace, source, name string, srv Service) error {
	subsets := make([]corev1.EndpointSubset, 0)
	for _, s := range srv.Endpoint.Subsets {
		addrs := make([]corev1.EndpointAddress, len(s.Addresses))
		for j, a := range s.Addresses {
			addrs[j] = corev1.EndpointAddress{IP: a.IP}
		}

		subsets = append(subsets, corev1.EndpointSubset{
			Addresses: addrs,
			Ports:     s.Ports,
		})
	}

	targetEndpoint := &corev1.Endpoints{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels:    addKedgeLabels(srv.Endpoint.Labels, source),
		},
		Subsets: subsets,
	}

	_, err := clientset.CoreV1().Endpoints(namespace).Create(context.Background(), targetEndpoint, metav1.CreateOptions{})
	if err != nil {
		return xerrors.Errorf("cannot create endpoint: %w", err)
	}
	return nil
}

func addKedgeLabels(labels map[string]string, src string) map[string]string {
	labels[LabelKedge] = "true"
	labels[LabelSource] = src
	return labels
}
