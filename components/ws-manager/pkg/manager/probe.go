// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"crypto/tls"
	"net/http"
	"net/url"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
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
	workspaceURL.Path += "/_supervisor/v1/status/ide"
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
		},
	}

	for {
		if ctx.Err() != nil {
			return WorkspaceProbeStopped
		}

		resp, err := client.Get(p.readyURL)
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
		resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			break
		}

		log.WithField("url", p.readyURL).WithField("status", resp.StatusCode).Debug("workspace did not respond to ready probe with OK status")
		time.Sleep(p.RetryDelay)
	}

	// workspace is actually ready
	return WorkspaceProbeReady
}
