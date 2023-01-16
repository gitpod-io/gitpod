// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package k8s

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"

	"github.com/cockroachdb/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
	u, err := url.Parse(c.config.Host)
	if err != nil {
		return errors.Wrap(err, "couldn't parse k8s host url")
	}
	u.Path = path
	u.Scheme = "https"

	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: roundTripper}, http.MethodPost, u)

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

func (c *Config) GetSVCTargets(ctx context.Context, name, namespace string) ([]string, error) {
	svc, err := c.CoreClient.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	pods, err := c.CoreClient.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: metav1.FormatLabelSelector(&metav1.LabelSelector{
			MatchLabels: svc.Spec.Selector,
		}),
	})

	podList := make([]string, 0, len(pods.Items))
	for _, p := range pods.Items {
		podList = append(podList, p.Name)
	}

	return podList, err
}
