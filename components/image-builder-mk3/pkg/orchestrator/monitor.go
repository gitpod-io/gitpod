// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package orchestrator

import (
	"context"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/image-builder/api"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// monitor subscribes to the ws-manager, listens for build updates and distributes them internally
func (o *Orchestrator) monitor() {
	ctx := context.Background()
	for {
		sub, err := o.wsman.Subscribe(ctx, &wsmanapi.SubscribeRequest{
			MustMatch: &wsmanapi.MetadataFilter{
				Owner: buildWorkspaceOwnerID,
			},
		})
		if err != nil {
			log.WithError(err).Info("connection to ws-manager lost - retrying")
			time.Sleep(5 * time.Second)
			continue
		}

		for {
			msg, err := sub.Recv()
			if err != nil {
				log.WithError(err).Info("connection to ws-manager lost - retrying")
				time.Sleep(5 * time.Second)
				break
			}

			log := msg.GetLog()
			if log != nil {
				o.publishLog(log.Id, log.Message)
				continue
			}

			status := msg.GetStatus()
			if status != nil {
				o.publishStatus(status)
				continue
			}
		}
	}
}

// retryIfUnavailable makes multiple attempts to execute op if op returns an UNAVAILABLE gRPC status code
func retryIfUnavailable(ctx context.Context, op func(ctx context.Context) error, initialBackoff time.Duration, retries int) (err error) {
	span, ctx := tracing.FromContext(ctx, "retryIfUnavailable")
	defer tracing.FinishSpan(span, &err)

	for i := 0; i < retries; i++ {
		err := op(ctx)
		span.LogKV("attempt", i)

		if st, ok := status.FromError(err); ok && st.Code() == codes.Unavailable {
			// service is unavailable - try again aftersme time
			time.Sleep(initialBackoff * time.Duration(1+i))
			log.WithField("attempt", i).Warn("ws-manager currently unavailable - retrying")
			continue
		}

		if err != nil {
			return err
		}
		return nil
	}

	// we've maxed out our retry attempts
	return status.Error(codes.Unavailable, "workspace services are currently unavailable")
}

func (o *Orchestrator) censor(buildID string, words []string) {
	o.mu.Lock()
	defer o.mu.Unlock()

	o.censorship[buildID] = words
}

func (o *Orchestrator) publishLog(buildID string, message string) {
	o.mu.RLock()
	listener, ok := o.logListener[buildID]
	o.mu.RUnlock()

	// we don't have any log listener for this build
	if !ok {
		return
	}

	o.mu.RLock()
	wds := o.censorship[buildID]
	o.mu.RUnlock()
	for _, w := range wds {
		message = strings.ReplaceAll(message, w, "")
	}

	for l := range listener {
		select {
		case l <- &api.LogsResponse{
			Content: []byte(message),
		}:
			continue

		case <-time.After(5 * time.Second):
			log.Warn("timeout while forwarding log to listener - dropping listener")
			o.mu.Lock()
			ll := o.logListener[buildID]
			// In the meantime the listener list may have been removed/cleared by a call to clearListener.
			// We don't have to do any work in this case.
			if ll != nil {
				close(l)
				delete(ll, l)
			}
			o.mu.Unlock()
		}
	}
}

func (o *Orchestrator) publishStatus(msg *wsmanapi.WorkspaceStatus) {
	o.mu.RLock()
	listener, ok := o.buildListener[msg.Id]
	o.mu.RUnlock()

	// we don't have any log listener for this build
	if !ok {
		return
	}

	resp := extractBuildResponse(msg)
	for l := range listener {
		select {
		case l <- resp:
			continue

		case <-time.After(5 * time.Second):
			log.Warn("timeout while forwarding status to listener - dropping listener")
			o.mu.Lock()
			ll := o.buildListener[msg.Id]
			// In the meantime the listener list may have been removed/cleared by a call to clearListener.
			// We don't have to do any work in this case.
			if ll != nil {
				close(l)
				delete(ll, l)
			}
			o.mu.Unlock()
		}
	}
}

func extractBuildResponse(status *wsmanapi.WorkspaceStatus) *api.BuildResponse {
	var (
		s   = api.BuildStatus_running
		msg = status.Message
	)
	if status.Phase == wsmanapi.WorkspacePhase_STOPPING {
		if status.Conditions.Failed == "" {
			s = api.BuildStatus_done_success
		} else {
			s = api.BuildStatus_done_failure
			msg = status.Conditions.Failed
		}
	}

	return &api.BuildResponse{
		Ref:     status.Metadata.Annotations["ref"],
		BaseRef: status.Metadata.Annotations["baseref"],
		Message: msg,
		Status:  s,
	}
}

type buildListener chan *api.BuildResponse

type logListener chan *api.LogsResponse

func (o *Orchestrator) registerBuildListener(buildID string) (c <-chan *api.BuildResponse, cancel func()) {
	o.mu.Lock()
	defer o.mu.Unlock()

	l := make(buildListener)
	ls := o.buildListener[buildID]
	if ls == nil {
		ls = make(map[buildListener]struct{})
	}
	ls[l] = struct{}{}
	o.buildListener[buildID] = ls

	cancel = func() {
		o.mu.Lock()
		defer o.mu.Unlock()
		ls := o.buildListener[buildID]
		if ls == nil {
			return
		}
		delete(ls, l)
		o.buildListener[buildID] = ls
	}
	return l, cancel
}

func (o *Orchestrator) registerLogListener(buildID string) (c <-chan *api.LogsResponse, cancel func()) {
	o.mu.Lock()
	defer o.mu.Unlock()

	l := make(logListener)
	ls := o.logListener[buildID]
	if ls == nil {
		ls = make(map[logListener]struct{})
	}
	ls[l] = struct{}{}
	o.logListener[buildID] = ls

	cancel = func() {
		o.mu.Lock()
		defer o.mu.Unlock()
		ls := o.logListener[buildID]
		if ls == nil {
			return
		}
		delete(ls, l)
		o.logListener[buildID] = ls
	}
	return l, cancel
}

func (o *Orchestrator) clearListener(buildID string) {
	o.mu.Lock()
	defer o.mu.Unlock()

	delete(o.buildListener, buildID)
	delete(o.logListener, buildID)
	delete(o.censorship, buildID)
}
