// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"crypto/tls"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"golang.org/x/xerrors"
	"k8s.io/apimachinery/pkg/util/json"
)

// WorkspaceProbeResult marks the result of a workspace probe
type WorkspaceProbeResult string

const (
	// WorkspaceProbeReady means that the probe found the workspace ready in time
	WorkspaceProbeReady WorkspaceProbeResult = "ready"

	// WorkspaceProbeStopped means that the probe (and probably the) workspace itself was stopped
	WorkspaceProbeStopped WorkspaceProbeResult = "stopped"
)

// WorkspaceReadyProbe repeatedly checks if a workspace reports as ready
type WorkspaceReadyProbe struct {
	Timeout    time.Duration
	RetryDelay time.Duration

	bypass      func() WorkspaceProbeResult
	readyURL    string
	workspaceID string
}

// NewWorkspaceReadyProbe creates a new workspace probe
func NewWorkspaceReadyProbe(workspaceID string, workspaceURL url.URL) WorkspaceReadyProbe {
	workspaceURL.Path += "/_supervisor/v1/status/ide/wait/true"
	readyURL := workspaceURL.String()

	return WorkspaceReadyProbe{
		Timeout:     5 * time.Second,
		RetryDelay:  500 * time.Millisecond,
		readyURL:    readyURL,
		workspaceID: workspaceID,
	}
}

// Run starts the probe. This function returns when the probe finishes, times out or is stopped.
func (p *WorkspaceReadyProbe) Run(ctx context.Context) WorkspaceProbeResult {
	if p.bypass != nil {
		// Note: the probe bypass is used during testing only.
		//       If you ever see this log line in production we have a configuration issue!
		log.WithFields(log.OWI("", "", p.workspaceID)).Warn("not actually probing workspace but using bypass")
		return p.bypass()
	}

	owi := log.OWI("", "", p.workspaceID)
	log := log.WithFields(owi)
	span, ctx := tracing.FromContext(ctx, "WorkspaceReadyProbe.Run")
	span.SetTag("timeout", p.Timeout)
	tracing.ApplyOWI(span, owi)
	defer tracing.FinishSpan(span, nil)

	client := &http.Client{
		Timeout: p.Timeout,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
				DualStack: false,
			}).DialContext,
			MaxIdleConns:          0,
			MaxIdleConnsPerHost:   32,
			IdleConnTimeout:       30 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 5 * time.Second,
			DisableKeepAlives:     true,
		},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	for {
		if ctx.Err() != nil {
			return WorkspaceProbeStopped
		}

		result, err := callWorkspaceProbe(p.readyURL, client)
		if err != nil {
			urlerr, ok := err.(*url.Error)
			if !ok || !urlerr.Timeout() {
				log.WithError(err).Debug("got a non-timeout error during workspace probe")
				time.Sleep(p.RetryDelay)
				continue
			}

			// we've timed out - do not log this as it would spam the logs for no good reason
			continue
		}

		if !result.Ok {
			log.WithField("url", p.readyURL).Debug("workspace did not respond to ready probe with OK status")
			time.Sleep(p.RetryDelay)
			continue
		}

		break
	}

	// workspace is actually ready
	return WorkspaceProbeReady
}

type probeResult struct {
	Ok bool `json:"ok"`
}

func callWorkspaceProbe(url string, client *http.Client) (*probeResult, error) {
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, xerrors.Errorf("workspace probe request returned %v as status code", resp.StatusCode)
	}

	rawBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result probeResult
	err = json.Unmarshal(rawBody, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}
