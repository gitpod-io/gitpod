// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package hosts

import (
	"fmt"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
)

// ServiceClusterIPSource reports the cluster IP's of services as host source.
// This host source most likely only works in proxy mode
type ServiceClusterIPSource struct {
	ID        string
	Clientset kubernetes.Interface
	Namespace string
	Selector  string
	Alias     string

	hosts map[string]string
	close chan struct{}
	src   chan []Host
}

// Name returns the ID of this source
func (s *ServiceClusterIPSource) Name() string {
	return s.ID
}

// Start starts this source
func (s *ServiceClusterIPSource) Start() error {
	s.close = make(chan struct{})
	s.src = make(chan []Host)
	s.hosts = make(map[string]string)

	opts := metav1.ListOptions{
		LabelSelector: s.Selector,
	}
	srvs, err := s.Clientset.CoreV1().Services(s.Namespace).List(opts)
	if err != nil {
		return xerrors.Errorf("cannot list services: %w", err)
	}
	for _, srv := range srvs.Items {
		if srv.Spec.Type != corev1.ServiceTypeClusterIP {
			continue
		}
		if srv.Spec.ClusterIP == "" || srv.Spec.ClusterIP == "None" {
			continue
		}
		for _, prt := range srv.Spec.Ports {
			if prt.Protocol != corev1.ProtocolTCP {
				continue
			}

			s.hosts[fmt.Sprintf("%s:%d", srv.Name, prt.Port)] = fmt.Sprintf("%s:%d", srv.Spec.ClusterIP, prt.Port)
		}
	}
	s.publish()

	wtch, err := s.Clientset.CoreV1().Services(s.Namespace).Watch(opts)
	if err != nil {
		return xerrors.Errorf("cannot watch services: %w", err)
	}
	go func() {
		for {
		evtloop:
			for {
				select {
				case evt := <-wtch.ResultChan():
					switch evt.Type {
					case watch.Added, watch.Modified:
						srv, ok := evt.Object.(*corev1.Service)
						if !ok {
							continue
						}
						if srv.Spec.Type != corev1.ServiceTypeClusterIP {
							continue
						}
						if srv.Spec.ClusterIP == "" || srv.Spec.ClusterIP == "None" {
							continue
						}
						for _, prt := range srv.Spec.Ports {
							if prt.Protocol != corev1.ProtocolTCP {
								continue
							}

							s.hosts[fmt.Sprintf("%s:%d", srv.Name, prt.Port)] = fmt.Sprintf("%s:%d", srv.Spec.ClusterIP, prt.Port)
						}
						s.publish()
					case watch.Deleted:
						srv, ok := evt.Object.(*corev1.Service)
						if !ok {
							continue
						}
						for h := range s.hosts {
							if strings.HasPrefix(h, srv.Name) {
								delete(s.hosts, h)
							}
						}
						s.publish()
					case "", watch.Error:
						break evtloop
					}
				case <-s.close:
					wtch.Stop()
					log.WithField("selector", s.Selector).Info("service cluster IP source shutting down")
					return
				}
			}

			for {
				log.WithField("name", s.ID).Warn("Kubernetes service host source lost Kubernetes connection - reconnecting")
				time.Sleep(10 * time.Second)

				wtch, err = s.Clientset.CoreV1().Services(s.Namespace).Watch(opts)
				if err != nil {
					log.WithField("name", s.ID).WithError(err).Warn("cannot watch services: %w", err)
					continue
				}
				break
			}
		}
	}()

	return nil
}

// Stop stops this source from providing updates
func (s *ServiceClusterIPSource) Stop() {
	close(s.close)
}

func (s *ServiceClusterIPSource) publish() {
	// push to source chan
	ips := make(map[string]struct{})
	for _, ip := range s.hosts {
		ips[ip] = struct{}{}
	}

	// Note: using a map for ips here serves two purposes:
	//       1. it makes the IP addresses unique and prevents multiple entries
	//       2. it randomises the order of host entries which spreads the risk of
	//          an endpoint not being available anymore.

	hosts := make([]Host, len(ips))
	var i int
	for ip := range ips {
		hosts[i] = Host{
			Addr: ip,
			Name: s.Alias,
		}
		i++
	}
	log.WithField("name", s.ID).WithField("hosts", hosts).Debug("update hosts")

	s.src <- hosts
}

// Source returns this source's channel
func (s *ServiceClusterIPSource) Source() <-chan []Host {
	return s.src
}

// PodHostIPSource provides hosts based on Kubernetes pods
type PodHostIPSource struct {
	ID        string
	Clientset kubernetes.Interface
	Namespace string
	Selector  string
	Alias     string

	hosts map[string]string
	close chan struct{}
	src   chan []Host
}

// Name returns the ID of this source
func (s *PodHostIPSource) Name() string {
	return s.ID
}

// Start starts this source
func (s *PodHostIPSource) Start() error {
	s.close = make(chan struct{})
	s.src = make(chan []Host)
	s.hosts = make(map[string]string)

	opts := metav1.ListOptions{
		LabelSelector: s.Selector,
	}
	pods, err := s.Clientset.CoreV1().Pods(s.Namespace).List(opts)
	if err != nil {
		return xerrors.Errorf("cannot list pods: %w", err)
	}
	for _, p := range pods.Items {
		if p.Status.Phase != corev1.PodRunning {
			continue
		}

		s.hosts[p.Name] = p.Status.PodIP
	}
	s.publish()

	wtch, err := s.Clientset.CoreV1().Pods(s.Namespace).Watch(opts)
	if err != nil {
		return xerrors.Errorf("cannot watch pods: %w", err)
	}
	go func() {
		for {
		evtloop:
			for {
				select {
				case evt := <-wtch.ResultChan():
					switch evt.Type {
					case watch.Added, watch.Modified:
						pod, ok := evt.Object.(*corev1.Pod)
						if !ok {
							continue
						}
						if pod.Status.Phase != corev1.PodRunning {
							continue
						}
						s.hosts[pod.Name] = pod.Status.HostIP
						s.publish()
					case watch.Deleted:
						pod, ok := evt.Object.(*corev1.Pod)
						if !ok {
							continue
						}
						delete(s.hosts, pod.Name)
						s.publish()
					case watch.Error:
						break evtloop
					}
				case <-s.close:
					wtch.Stop()
					log.WithField("selector", s.Selector).Info("pod host IP source shutting down")
					return
				}
			}

			for {
				log.WithField("name", s.ID).Warn("Kubernetes pod host source lost Kubernetes connection - reconnecting")
				time.Sleep(10 * time.Second)

				wtch, err = s.Clientset.CoreV1().Pods(s.Namespace).Watch(opts)
				if err != nil {
					log.WithField("name", s.ID).WithError(err).Warn("cannot watch pods: %w", err)
					continue
				}
				break
			}
		}
	}()

	return nil
}

// Stop stops this source from providing updates
func (s *PodHostIPSource) Stop() {
	close(s.close)
}

func (s *PodHostIPSource) publish() {
	// push to source chan
	ips := make(map[string]struct{})
	for _, ip := range s.hosts {
		ips[ip] = struct{}{}
	}

	// Note: using a map for ips here serves two purposes:
	//       1. it makes the IP addresses unique and prevents multiple entries
	//       2. it randomises the order of host entries which spreads the risk of
	//          an endpoint not being available anymore.

	hosts := make([]Host, len(ips))
	var i int
	for ip := range ips {
		hosts[i] = Host{
			Addr: ip,
			Name: s.Alias,
		}
		i++
	}
	log.WithField("name", s.ID).WithField("hosts", hosts).Debug("update hosts")

	s.src <- hosts
}

// Source returns this source's channel
func (s *PodHostIPSource) Source() <-chan []Host {
	return s.src
}
