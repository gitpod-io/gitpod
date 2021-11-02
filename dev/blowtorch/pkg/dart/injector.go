// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dart

import (
	"context"
	"fmt"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

const (
	fmtOriginalService        = "%s-original"
	fmtProxyDeployment        = "%s-toxiproxy"
	renamedServiceLabelPrefix = "renamed-"
)

type injectOptions struct {
	AdditionalRoutes map[int][]int
}

// InjectOption customizes the injection behaviour
type InjectOption func(*injectOptions)

// WithAdditionalRoute adds an additional route over the same service but on a different port.
// This is handy if one wants to affect services differently from each other, as each of them
// get different proxies.
func WithAdditionalRoute(targetPort int, additionalPort int) InjectOption {
	return func(o *injectOptions) {
		var r = o.AdditionalRoutes[targetPort]
		r = append(r, additionalPort)
		o.AdditionalRoutes[targetPort] = r
	}
}

// Inject launches a toxiproxy pod that forwards all original traffic from a service
// via that toxiproxy.
func Inject(cfg *rest.Config, namespace, targetService string, options ...InjectOption) (*ProxiedToxiproxy, error) {
	opts := injectOptions{
		AdditionalRoutes: make(map[int][]int),
	}
	for _, opt := range options {
		opt(&opts)
	}

	client, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	oldService, err := client.CoreV1().Services(namespace).Get(context.Background(), targetService, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	log.WithField("name", oldService.Name).Info("target service found")

	// service.Spec.Selector
	pods, err := client.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{
		LabelSelector: labels.FormatLabels(oldService.Spec.Selector),
	})
	if err != nil {
		return nil, err
	}
	if len(pods.Items) == 0 {
		return nil, xerrors.Errorf("found no pods matching the service selector")
	}
	originalPod := pods.Items[0]
	log.WithField("name", originalPod.Name).Info("original pods found")

	var ndname string
	if opsegs := strings.Split(originalPod.Name, "-"); len(opsegs) > 2 {
		ndname = strings.Join(opsegs[:len(opsegs)-2], "-")
	} else {
		ndname = originalPod.Name
	}
	ndname = fmt.Sprintf(fmtProxyDeployment, ndname)

	var (
		labels = map[string]string{
			"blowtorch.sh/component": "toxiproxy",
			"blowtorch.sh/id":        originalPod.ResourceVersion,
		}
		replicas int32 = 1
		uid      int64 = 1000
	)
	newDeployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      ndname,
			Namespace: originalPod.Namespace,
			Labels:    labels,
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: &replicas,
			Selector: metav1.SetAsLabelSelector(labels),
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Name:   ndname,
					Labels: labels,
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  "proxy",
							Image: "shopify/toxiproxy",
							SecurityContext: &corev1.SecurityContext{
								RunAsUser: &uid,
							},
						},
					},
					ServiceAccountName: originalPod.Spec.ServiceAccountName,
				},
			},
		},
	}
	_, err = client.AppsV1().Deployments(namespace).Create(context.Background(), newDeployment, metav1.CreateOptions{})
	if err != nil && !strings.Contains(err.Error(), "already exists") {
		return nil, err
	}
	log.WithField("name", ndname).Info("deployment created")

	renamedSpec := oldService.Spec.DeepCopy()
	renamedSpec.ClusterIP = ""
	renamedSpec.ClusterIPs = []string{}
	renamedMeta := oldService.ObjectMeta.DeepCopy()
	renamedMeta.Name = fmt.Sprintf(fmtOriginalService, oldService.Name)
	renamedMeta.ResourceVersion = ""
	renamedMeta.Labels = make(map[string]string)
	for k, v := range oldService.ObjectMeta.Labels {
		renamedKey := fmt.Sprintf("%s%s", renamedServiceLabelPrefix, k)
		renamedMeta.Labels[renamedKey] = v
	}
	renamedService := &corev1.Service{
		ObjectMeta: *renamedMeta,
		Spec:       *renamedSpec,
	}
	renamedService, err = client.CoreV1().Services(namespace).Create(context.Background(), renamedService, metav1.CreateOptions{})
	if err != nil {
		return nil, err
	}
	var (
		deletionPolicy       = metav1.DeletePropagationForeground
		gracePeriod    int64 = 30
	)
	err = client.CoreV1().Services(namespace).Delete(context.Background(), oldService.Name,
		metav1.DeleteOptions{PropagationPolicy: &deletionPolicy, GracePeriodSeconds: &gracePeriod})
	if err != nil {
		return nil, err
	}
	log.Info("original service renamed")

	newSpec := oldService.Spec.DeepCopy()
	newSpec.ClusterIP = ""
	newSpec.ClusterIPs = []string{}
	newSpec.Selector = labels
	newMeta := oldService.ObjectMeta.DeepCopy()
	if newMeta.Labels == nil {
		newMeta.Labels = make(map[string]string)
	}
	for k, v := range labels {
		newMeta.Labels[k] = v
	}
	newMeta.ResourceVersion = ""
	var additionalPorts []corev1.ServicePort
	for tp, aps := range opts.AdditionalRoutes {
		var op *corev1.ServicePort
		for _, pspec := range newSpec.Ports {
			if pspec.TargetPort.IntValue() == tp {
				op = &pspec
				break
			}
		}
		if op == nil {
			log.WithField("targetPort", tp).WithField("routes", aps).Warn("cannot find target port in service - not adding additional routes")
			continue
		}

		for _, ap := range aps {
			sp := op.DeepCopy()
			sp.Name = fmt.Sprintf("%s-ar-%d", sp.Name, ap)
			sp.Port = int32(ap)
			sp.TargetPort = intstr.FromInt(ap)
			additionalPorts = append(additionalPorts, *sp)
		}
	}
	newSpec.Ports = append(newSpec.Ports, additionalPorts...)
	newService := &corev1.Service{
		ObjectMeta: *newMeta,
		Spec:       *newSpec,
	}
	for i := 0; i < 10; i++ {
		cs, err := client.CoreV1().Services(namespace).Create(context.Background(), newService, metav1.CreateOptions{})
		if err == nil {
			newService = cs
			break
		}

		if strings.Contains(err.Error(), "object is being deleted") {
			log.WithField("name", newService.Name).Info("original service still exists - retrying in four seconds")
			time.Sleep(4 * time.Second)
			continue
		}
		return nil, err
	}
	log.WithField("name", newService.Name).Info("new service created")

	err = wait.PollImmediate(1*time.Second, 30*time.Second, func() (bool, error) {
		depl, err := client.AppsV1().Deployments(namespace).Get(context.Background(), newDeployment.Name, metav1.GetOptions{})
		if err != nil {
			return false, err
		}

		return depl.Status.ReadyReplicas >= 1, nil

	})
	if err != nil {
		return nil, xerrors.Errorf("cannot wait for proxy pod: %w", err)
	}
	log.Info("proxy pod up and running")

	proxyPods, err := client.CoreV1().Pods(namespace).List(
		context.Background(),
		metav1.ListOptions{
			LabelSelector: metav1.FormatLabelSelector(metav1.SetAsLabelSelector(labels)),
		},
	)
	if err != nil {
		return nil, nil
	}
	if len(proxyPods.Items) == 0 {
		return nil, xerrors.Errorf("no proxy pod found")
	}
	tppod := proxyPods.Items[0].Name

	tpc, err := NewProxiedToxiproxy(cfg, namespace, tppod)
	if err != nil {
		return nil, xerrors.Errorf("cannot start proxy: %w", err)
	}

	for _, p := range oldService.Spec.Ports {
		_, err := tpc.CreateProxy(targetService, fmt.Sprintf(":%d", p.TargetPort.IntVal), fmt.Sprintf("%s:%d", renamedService.Name, p.Port))
		if err != nil {
			return nil, xerrors.Errorf("cannot proxy port %d -> %d: %w", p.TargetPort.IntVal, p.Port, err)
		}
		log.WithField("port", p.Port).Infof("toxiproxy for port %d -> %d set up", p.TargetPort.IntVal, p.Port)
	}
	for tp, aps := range opts.AdditionalRoutes {
		for _, ap := range aps {
			_, err := tpc.CreateProxy(fmt.Sprintf("%s-%d", targetService, ap), fmt.Sprintf(":%d", ap), fmt.Sprintf("%s:%d", renamedService.Name, tp))
			if err != nil {
				log.WithField("targetPort", tp).WithField("additionalPort", ap).WithError(err).Warn("cannot proxy additional port")
			}
			log.WithField("port", ap).Infof("toxiproxy for port %d -> %d set up", ap, tp)
		}
	}

	return tpc, nil
}

// Remove reverts the changes made by inject
func Remove(cfg *rest.Config, namespace, targetService string) error {
	client, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return err
	}

	proxiedService, err := client.CoreV1().Services(namespace).Get(context.Background(), fmt.Sprintf(fmtOriginalService, targetService), metav1.GetOptions{})
	if err != nil {
		return err
	}
	log.WithField("name", proxiedService.Name).Info("original service found")

	var (
		deletionPolicy       = metav1.DeletePropagationForeground
		gracePeriod    int64 = 30
	)
	err = client.CoreV1().Services(namespace).Delete(context.Background(), targetService, metav1.DeleteOptions{
		GracePeriodSeconds: &gracePeriod,
		PropagationPolicy:  &deletionPolicy,
	})
	if err != nil {
		return err
	}
	log.WithField("name", targetService).Info("proxy service deleted")

	renamedSpec := proxiedService.Spec.DeepCopy()
	renamedSpec.ClusterIP = ""
	renamedMeta := proxiedService.ObjectMeta.DeepCopy()
	renamedMeta.Name = targetService
	renamedMeta.ResourceVersion = ""
	renamedMeta.Labels = make(map[string]string)
	for k, v := range proxiedService.ObjectMeta.Labels {
		renamedKey := strings.TrimPrefix(k, renamedServiceLabelPrefix)
		renamedMeta.Labels[renamedKey] = v
	}
	renamedService := &corev1.Service{
		ObjectMeta: *renamedMeta,
		Spec:       *renamedSpec,
	}
	for i := 0; i < 10; i++ {
		_, err = client.CoreV1().Services(namespace).Create(context.Background(), renamedService, metav1.CreateOptions{})
		if err == nil {
			break
		}

		if strings.Contains(err.Error(), "object is being deleted") {
			log.WithField("name", renamedService.Name).Info("proxy service still exists - retrying in four seconds")
			time.Sleep(4 * time.Second)
			continue
		}
		return err
	}
	err = client.CoreV1().Services(namespace).Delete(context.Background(), proxiedService.Name,
		metav1.DeleteOptions{PropagationPolicy: &deletionPolicy, GracePeriodSeconds: &gracePeriod})
	if err != nil {
		return err
	}
	log.WithField("name", proxiedService.Name).Info("original service renamed")

	pdp := fmt.Sprintf(fmtProxyDeployment, targetService)
	err = client.AppsV1().Deployments(namespace).Delete(context.Background(), pdp, metav1.DeleteOptions{
		PropagationPolicy:  &deletionPolicy,
		GracePeriodSeconds: &gracePeriod,
	})
	if err != nil {
		return err
	}
	log.WithField("name", pdp).Info("proxy deployment deleted")

	return nil
}
