// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package orchestrator

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"strings"
	"sync"
	"time"

	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/hashicorp/go-retryablehttp"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/image-builder/api"
)

const (
	annotationRef     = "ref"
	annotationBaseRef = "baseref"
)

type orchestrator interface {
	PublishStatus(buildID string, resp *api.BuildResponse)
	PublishLog(buildID string, message string)
}

func newBuildMonitor(o orchestrator, wsman wsmanapi.WorkspaceManagerClient) *buildMonitor {
	return &buildMonitor{
		O:             o,
		wsman:         wsman,
		runningBuilds: make(map[string]*runningBuild),
		logs:          map[string]context.CancelFunc{},
	}
}

type buildMonitor struct {
	O orchestrator

	wsman           wsmanapi.WorkspaceManagerClient
	runningBuilds   map[string]*runningBuild
	runningBuildsMu sync.RWMutex

	logs map[string]context.CancelFunc
}

type runningBuild struct {
	Info api.BuildInfo
	Logs buildLogs
}

type buildLogs struct {
	IdeURL     string
	OwnerToken string
}

// Run subscribes to the ws-manager, listens for build updates and distributes them internally
func (m *buildMonitor) Run() {
	ctx := context.Background()
	for {
		wss, err := m.wsman.GetWorkspaces(ctx, &wsmanapi.GetWorkspacesRequest{
			MustMatch: &wsmanapi.MetadataFilter{
				Owner: buildWorkspaceOwnerID,
			},
		})
		if err != nil {
			log.WithError(err).Info("cannot get running builds from ws-manager - retrying")
			time.Sleep(5 * time.Second)
			continue
		}
		m.runningBuildsMu.Lock()
		m.runningBuilds = make(map[string]*runningBuild, len(wss.Status))
		m.runningBuildsMu.Unlock()
		for _, ws := range wss.Status {
			m.handleStatusUpdate(ws)
		}

		sub, err := m.wsman.Subscribe(ctx, &wsmanapi.SubscribeRequest{
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

			status := msg.GetStatus()
			if status == nil {
				continue
			}

			m.handleStatusUpdate(status)
		}
	}
}

func (m *buildMonitor) handleStatusUpdate(status *wsmanapi.WorkspaceStatus) {
	var (
		bld  = extractRunningBuild(status)
		resp = extractBuildResponse(status)
	)
	m.runningBuildsMu.Lock()
	if resp.Status != api.BuildStatus_running {
		delete(m.runningBuilds, status.Id)
	} else {
		m.runningBuilds[status.Id] = bld
	}
	m.runningBuildsMu.Unlock()

	m.O.PublishStatus(status.Id, resp)

	// handleStatusUpdate is called from a single go-routine, hence there's no need to synchronize
	// access to m.logs
	if bld.Info.Status == api.BuildStatus_running {
		if _, ok := m.logs[status.Id]; !ok {
			// we don't have a headless log listener yet, but need one
			ctx, cancel := context.WithCancel(context.Background())
			go listenToHeadlessLogs(ctx, bld.Logs.IdeURL, bld.Logs.OwnerToken, m.handleHeadlessLogs(status.Id))
			m.logs[status.Id] = cancel
		}
	} else {
		if cancel, ok := m.logs[status.Id]; ok {
			// we have a headless log listener, and need to stop it
			cancel()
			delete(m.logs, status.Id)
		}
	}
}

func (m *buildMonitor) handleHeadlessLogs(buildID string) listenToHeadlessLogsCallback {
	return func(content []byte, err error) {
		if err != nil && !errors.Is(err, context.Canceled) {
			log.WithError(err).WithField("buildID", buildID).Warn("headless log listener failed")
			m.O.PublishLog(buildID, "Build log listener failed. The image build is still running, but you won't see any log output.")
			return
		}

		if len(content) > 0 {
			m.O.PublishLog(buildID, string(content))
		}
	}
}

var errOutOfRetries = xerrors.Errorf("out of retries")

// retry makes multiple attempts to execute op if op returns an UNAVAILABLE gRPC status code
func retry(ctx context.Context, op func(ctx context.Context) error, retry func(err error) bool, initialBackoff time.Duration, retries int) (err error) {
	span, ctx := tracing.FromContext(ctx, "retryIfUnavailable")
	defer tracing.FinishSpan(span, &err)

	for i := 0; i < retries; i++ {
		err := op(ctx)
		span.LogKV("attempt", i)

		if retry(err) {
			time.Sleep(initialBackoff * time.Duration(1+i))
			continue
		}
		if err != nil {
			return err
		}
		return nil
	}

	// we've maxed out our retry attempts
	return errOutOfRetries
}

func extractBuildStatus(status *wsmanapi.WorkspaceStatus) *api.BuildInfo {
	s := api.BuildStatus_running
	if status.Phase == wsmanapi.WorkspacePhase_STOPPING || status.Phase == wsmanapi.WorkspacePhase_STOPPED {
		if status.Conditions.Failed == "" && status.Conditions.HeadlessTaskFailed == "" {
			s = api.BuildStatus_done_success
		} else {
			s = api.BuildStatus_done_failure
		}
	}

	return &api.BuildInfo{
		BuildId:   status.Metadata.MetaId,
		Ref:       status.Metadata.Annotations[annotationRef],
		BaseRef:   status.Metadata.Annotations[annotationBaseRef],
		Status:    s,
		StartedAt: status.Metadata.StartedAt.Seconds,
	}
}

func extractRunningBuild(status *wsmanapi.WorkspaceStatus) *runningBuild {
	return &runningBuild{
		Info: *extractBuildStatus(status),
		Logs: buildLogs{
			IdeURL:     status.Spec.Url,
			OwnerToken: status.Auth.OwnerToken,
		},
	}
}

func extractBuildResponse(status *wsmanapi.WorkspaceStatus) *api.BuildResponse {
	var (
		info = extractBuildStatus(status)
		msg  = status.Message
	)
	if status.Phase == wsmanapi.WorkspacePhase_STOPPING {
		if status.Conditions.Failed != "" {
			msg = status.Conditions.Failed
		} else if status.Conditions.HeadlessTaskFailed != "" {
			msg = status.Conditions.HeadlessTaskFailed
		}
	}

	return &api.BuildResponse{
		Ref:     info.Ref,     // set for backwards compatibilty - new clients should consume Info
		BaseRef: info.BaseRef, // set for backwards compatibilty - new clients should consume Info
		Status:  info.Status,
		Message: msg,
		Info:    info,
	}
}

func (m *buildMonitor) GetAllRunningBuilds(ctx context.Context) (res []*runningBuild, err error) {
	m.runningBuildsMu.RLock()
	defer m.runningBuildsMu.RUnlock()

	res = make([]*runningBuild, 0, len(m.runningBuilds))
	for _, ws := range m.runningBuilds {
		res = append(res, ws)
	}

	return
}

func (m *buildMonitor) RegisterNewBuild(buildID string, ref, baseRef, url, ownerToken string) {
	m.runningBuildsMu.Lock()
	defer m.runningBuildsMu.Unlock()

	bld := &runningBuild{
		Info: api.BuildInfo{
			BuildId:   buildID,
			Ref:       ref,
			BaseRef:   baseRef,
			Status:    api.BuildStatus_running,
			StartedAt: time.Now().Unix(),
		},
		Logs: buildLogs{
			IdeURL:     url,
			OwnerToken: ownerToken,
		},
	}
	m.runningBuilds[buildID] = bld
	log.WithField("build", bld).WithField("buildID", buildID).Debug("new build registered")
}

type listenToHeadlessLogsCallback func(content []byte, err error)

func listenToHeadlessLogs(ctx context.Context, url, authToken string, callback listenToHeadlessLogsCallback) {
	var err error
	defer func() {
		if err != nil {
			callback(nil, err)
		}
	}()

	var logURL string
	err = retry(ctx, func(ctx context.Context) (err error) {
		logURL, err = findTaskLogURL(ctx, url, authToken)
		return
	}, func(err error) bool {
		if err == nil {
			return false
		}
		if errors.Is(err, io.EOF) {
			// the network is not reliable
			return true
		}
		if strings.Contains(err.Error(), "received non-200 status") {
			// gRPC-web race in supervisor?
			return true
		}
		return false
	}, 1*time.Second, 30)
	if err != nil {
		return
	}
	log.WithField("logURL", logURL).Debug("found log URL")
	callback([]byte("connecting to log output ...\n"), nil)

	req, err := http.NewRequestWithContext(ctx, "GET", logURL, nil)
	if err != nil {
		return
	}
	req.Header.Set("x-gitpod-owner-token", authToken)
	req.Header.Set("Cache", "no-cache")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	log.WithField("logURL", logURL).Debug("terminal log response received")
	callback([]byte("connected to log output ...\n"), nil)

	defer resp.Body.Close()

	var line struct {
		Result struct {
			Data []byte `json:"data"`
		} `json:"result"`
	}

	dec := json.NewDecoder(resp.Body)
	for err == nil {
		err = dec.Decode(&line)
		if errors.Is(err, io.EOF) {
			// EOF is not an error in this case
			err = nil
			break
		}
		if err != nil {
			break
		}

		callback(line.Result.Data, nil)
	}
}

func findTaskLogURL(ctx context.Context, ideURL, authToken string) (taskLogURL string, err error) {
	ideURL = strings.TrimSuffix(ideURL, "/")
	tasksURL := ideURL + "/_supervisor/v1/status/tasks"
	req, err := http.NewRequestWithContext(ctx, "GET", tasksURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("x-gitpod-owner-token", authToken)
	req.Header.Set("Cache", "no-cache")

	client := retryablehttp.NewClient()
	client.RetryMax = 10
	client.Logger = nil

	resp, err := client.StandardClient().Do(req)
	if err != nil {
		return "", xerrors.Errorf("cannot connect to supervisor: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", xerrors.Errorf("received non-200 status from %s: %v", tasksURL, resp.StatusCode)
	}

	msg, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var respb struct {
		Result struct {
			Tasks []struct {
				Terminal string `json:"terminal"`
			} `json:"tasks"`
		} `json:"result"`
	}
	err = json.Unmarshal(msg, &respb)
	if err != nil {
		return "", xerrors.Errorf("cannot decode supervisor status response: %w", err)
	}

	if len(respb.Result.Tasks) == 0 {
		return "", xerrors.Errorf("build workspace has no tasks")
	}
	return fmt.Sprintf("%s/_supervisor/v1/terminal/listen/%s", ideURL, respb.Result.Tasks[0].Terminal), nil
}
