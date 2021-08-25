// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package util

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"golang.org/x/xerrors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
)

// GetKubeconfig loads kubernetes connection config from a kubeconfig file
func GetKubeconfig(kubeconfig string) (res *rest.Config, namespace string, err error) {
	cfg := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		&clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfig},
		&clientcmd.ConfigOverrides{},
	)
	namespace, _, err = cfg.Namespace()
	if err != nil {
		return nil, "", err
	}

	res, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		return nil, namespace, err
	}
	res.RateLimiter = &wsk8s.UnlimitedRateLimiter{}

	return res, namespace, nil
}

// FindAnyPodForComponent returns the first pod we found for a particular component
func FindAnyPodForComponent(clientSet kubernetes.Interface, namespace, label string) (podName string, err error) {
	pods, err := clientSet.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("component=%s", label),
	})
	if err != nil {
		return "", err
	}
	if len(pods.Items) == 0 {
		return "", xerrors.Errorf("no pod in %s with label component=%s", namespace, label)
	}
	return pods.Items[0].Name, nil
}

// ForwardPort establishes a TCP port forwarding to a Kubernetes pod
func ForwardPort(ctx context.Context, config *rest.Config, namespace, pod, port string) (readychan chan struct{}, errchan chan error) {
	errchan = make(chan error, 1)
	readychan = make(chan struct{}, 1)

	roundTripper, upgrader, err := spdy.RoundTripperFor(config)
	if err != nil {
		errchan <- err
		return
	}

	path := fmt.Sprintf("/api/v1/namespaces/%s/pods/%s/portforward", namespace, pod)
	hostIP := strings.TrimPrefix(config.Host, "https://")
	serverURL := url.URL{Scheme: "https", Path: path, Host: hostIP}
	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: roundTripper}, http.MethodPost, &serverURL)

	stopChan := make(chan struct{}, 1)
	fwdReadyChan := make(chan struct{}, 1)
	out, errOut := new(bytes.Buffer), new(bytes.Buffer)
	forwarder, err := portforward.New(dialer, []string{port}, stopChan, fwdReadyChan, out, errOut)
	if err != nil {
		panic(err)
	}

	var once sync.Once
	go func() {
		err := forwarder.ForwardPorts()
		if err != nil {
			errchan <- err
		}
		once.Do(func() { close(readychan) })
	}()

	go func() {
		select {
		case <-readychan:
			// we're out of here
		case <-ctx.Done():
			close(stopChan)
		}
	}()

	go func() {
		for range fwdReadyChan {
		}

		if errOut.Len() != 0 {
			errchan <- xerrors.Errorf(errOut.String())
			return
		}

		once.Do(func() { close(readychan) })
	}()

	return
}

// CertPoolFromSecret creates a x509 cert pool from a Kubernetes secret
func CertPoolFromSecret(clientSet kubernetes.Interface, namespace, secretName string, files []string) (cert *x509.CertPool, err error) {
	secret, err := clientSet.CoreV1().Secrets(namespace).Get(context.Background(), secretName, metav1.GetOptions{})
	if err != nil {
		return
	}
	cert = x509.NewCertPool()
	for _, file := range files {
		certFile := secret.Data[file]

		if !cert.AppendCertsFromPEM(certFile) {
			return nil, xerrors.Errorf("credentials: failed to append certificates")
		}
	}
	return
}

// CertFromSecret creates a cert from a Kubernetes secret
func CertFromSecret(clientSet kubernetes.Interface, namespace, secretName, certFile, keyFile string) (cert tls.Certificate, err error) {
	secret, err := clientSet.CoreV1().Secrets(namespace).Get(context.Background(), secretName, metav1.GetOptions{})
	if err != nil {
		return
	}
	certFileB := secret.Data[certFile]
	keyFileB := secret.Data[keyFile]
	return tls.X509KeyPair(certFileB, keyFileB)
}
