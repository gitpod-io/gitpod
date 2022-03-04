// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dart

import (
	"bytes"
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"sync"

	toxiproxy "github.com/Shopify/toxiproxy/client"
	log "github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"
)

const (
	// port to toxiproxy's control plane API
	toxiproxyPort = 8474
)

// ProxiedToxiproxy provides a connection to a toxiproxy pod
type ProxiedToxiproxy struct {
	*toxiproxy.Client
	closer func()
}

// NewProxiedToxiproxy connects to a Toxiproxy pod
func NewProxiedToxiproxy(cfg *rest.Config, namespace, pod string) (*ProxiedToxiproxy, error) {
	localPort := rand.Intn(2000) + 31000

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	readychan, errchan := forwardPort(ctx, cfg, namespace, pod, fmt.Sprintf("%d:%d", localPort, toxiproxyPort))
	select {
	case <-readychan:
	case err := <-errchan:
		return nil, err
	}
	log.WithField("port", localPort).Info("forwarding control API of toxiproxy")

	tpc := toxiproxy.NewClient(fmt.Sprintf("localhost:%d", localPort))
	return &ProxiedToxiproxy{
		Client: tpc,
		closer: cancel,
	}, nil
}

// Close shuts down the connection to the toxiproxy pod
func (p *ProxiedToxiproxy) Close() error {
	p.closer()
	return nil
}

// ForwardPort establishes a TCP port forwarding to a Kubernetes pod
func forwardPort(ctx context.Context, config *rest.Config, namespace, pod, port string) (readychan chan struct{}, errchan chan error) {
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
