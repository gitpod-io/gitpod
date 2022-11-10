// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package k8s

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/cockroachdb/errors"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"
)

type PortForwardOpts struct {
	Name                string
	Namespace           string
	Ports               []string
	ReadyChan, StopChan chan struct{}
	ErrChan             chan error
}

func (c *Config) PortForward(ctx context.Context, opts PortForwardOpts) error {
	roundTripper, upgrader, err := spdy.RoundTripperFor(c.config)
	if err != nil {
		panic(err)
	}

	path := fmt.Sprintf("/api/v1/namespaces/%s/pods/%s/portforward", opts.Namespace, opts.Name)
	hostIP := strings.TrimLeft(c.config.Host, "https://")
	serverURL := url.URL{Scheme: "https", Path: path, Host: hostIP}

	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: roundTripper}, http.MethodPost, &serverURL)

	out, errOut := new(bytes.Buffer), new(bytes.Buffer)
	forwarder, err := portforward.New(dialer, opts.Ports, opts.StopChan, opts.ReadyChan, out, errOut)
	if err != nil {
		return err
	}

	go func() {
		for range opts.ReadyChan { // Kubernetes will close this channel when it has something to tell us.
		}
		if len(errOut.String()) != 0 {
			opts.ErrChan <- errors.New(errOut.String())
		} else if len(out.String()) != 0 {
			c.logger.Debug(out.String())
		}
	}()

	if err = forwarder.ForwardPorts(); err != nil { // Locks until stopChan is closed.
		return err
	}

	return nil
}
