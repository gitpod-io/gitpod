// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"fmt"
	"os/exec"
	"reflect"
	"strings"
	"sync"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/content-service/pkg/git"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/serverapi"
	"golang.org/x/xerrors"
)

// GitTokenProvider provides tokens for Git hosting services by asking
// the Gitpod server.
type GitTokenProvider struct {
	notificationService *NotificationService
	workspaceConfig     WorkspaceConfig
	gitpodAPI           serverapi.APIInterface
}

// NewGitTokenProvider creates a new instance of gitTokenProvider.
func NewGitTokenProvider(gitpodAPI serverapi.APIInterface, workspaceConfig WorkspaceConfig, notificationService *NotificationService) *GitTokenProvider {
	return &GitTokenProvider{
		notificationService: notificationService,
		workspaceConfig:     workspaceConfig,
		gitpodAPI:           gitpodAPI,
	}
}

// GetToken resolves a token from a git hosting service.
func (p *GitTokenProvider) GetToken(ctx context.Context, req *api.GetTokenRequest) (tkn *Token, err error) {
	if p.gitpodAPI == nil {
		return nil, nil
	}
	token, err := p.gitpodAPI.GetToken(ctx, &gitpod.GetTokenSearchOptions{
		Host: req.Host,
	})
	if err != nil {
		return nil, err
	}
	if token.Value == "" {
		return nil, nil
	}
	scopes := make(map[string]struct{}, len(token.Scopes))
	for _, scp := range token.Scopes {
		scopes[scp] = struct{}{}
	}
	missing := getMissingScopes(req.Scope, scopes)
	if len(missing) > 0 {
		message := fmt.Sprintf("An operation requires additional permissions: %s. Please grant permissions and try again.", strings.Join(missing, ", "))
		result, err := p.notificationService.Notify(ctx, &api.NotifyRequest{
			Level:   api.NotifyRequest_INFO,
			Message: message,
			Actions: []string{"Open Access Control"},
		})
		if err != nil {
			return nil, err
		}
		if result.Action == "Open Access Control" {
			go func() {
				_ = p.openAccessControl()
			}()
		}
		return nil, xerrors.Errorf("miss required permissions")
	}
	tkn = &Token{
		User:  token.Username,
		Token: token.Value,
		Host:  req.Host,
		Scope: scopes,
		Reuse: api.TokenReuse_REUSE_NEVER,
	}
	return tkn, nil
}

func (p *GitTokenProvider) openAccessControl() error {
	gpPath, err := exec.LookPath("gp")
	if err != nil {
		return err
	}
	gpCmd := exec.Command(gpPath, "preview", "--external", p.workspaceConfig.GitpodHost+"/access-control")
	runAsGitpodUser(gpCmd)
	if b, err := gpCmd.CombinedOutput(); err != nil {
		log.WithField("Stdout", string(b)).WithError(err).Error("failed to exec gp preview to open access control")
		return err
	}
	return nil
}

func getMissingScopes(required []string, provided map[string]struct{}) []string {
	var missing []string
	for _, r := range required {
		if _, found := provided[r]; !found {
			missing = append(missing, r)
		}
	}
	return missing
}

const (
	minIntervalBetweenGitStatusUpdates = 5 * time.Second
	lastGitStatusTimeout               = 3 * time.Second
)

type GitStatusService struct {
	cfg           *Config
	content       ContentState
	git           *git.Client
	gitpodService serverapi.APIInterface
	experiments   experiments.Client
}

type gitStatusUpdateContext struct {
	lastSuccessfullStatus *gitpod.WorkspaceInstanceRepoStatus
	statusBackoff         *backoff.ExponentialBackOff
	updateBackoff         *backoff.ExponentialBackOff
}

func (s *GitStatusService) Run(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()

	<-s.content.ContentReady()
	if ctx.Err() != nil {
		return
	}

	updateContext := &gitStatusUpdateContext{
		statusBackoff: backoff.NewExponentialBackOff(),
		updateBackoff: backoff.NewExponentialBackOff(),
	}
	updateContext.statusBackoff.MaxElapsedTime = 30 * time.Second
	updateContext.updateBackoff.MaxElapsedTime = 30 * time.Second

	go func() {
		updates, err := s.gitpodService.WorkspaceUpdates(ctx)
		if err != nil {
			log.WithError(err).Error("git: error getting workspace updates")
			return
		}
		for {
			select {
			case <-ctx.Done():
				return
			case update := <-updates:
				if update == nil {
					return
				}
				updateContext.lastSuccessfullStatus = update.GitStatus
			}
		}
	}()

	ticker := time.NewTicker(minIntervalBetweenGitStatusUpdates)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			shutdownCtx, shutdown := context.WithTimeout(context.Background(), lastGitStatusTimeout)
			defer shutdown()
			updateContext.statusBackoff.Reset()
			updateContext.updateBackoff.Reset()
			s.update(shutdownCtx, updateContext)
			return
		case <-ticker.C:
			s.update(ctx, updateContext)
		}
	}
}

func (s *GitStatusService) update(ctx context.Context, updateContext *gitStatusUpdateContext) {
	status, err := s.git.Status(ctx)
	if err != nil {
		log.WithError(err).Error("git: error getting status")
		time.Sleep(updateContext.statusBackoff.NextBackOff())
		return
	}
	updateContext.statusBackoff.Reset()

	var newStatus *gitpod.WorkspaceInstanceRepoStatus
	if status != nil {
		limit := func(entries []string) []string {
			const maxPendingChanges = 100
			if len(entries) > maxPendingChanges {
				return append(entries[0:maxPendingChanges], fmt.Sprintf("... and %d more", len(entries)-maxPendingChanges))
			}

			return entries
		}
		newStatus = &gitpod.WorkspaceInstanceRepoStatus{
			Branch:               status.BranchHead,
			LatestCommit:         status.LatestCommit,
			TotalUncommitedFiles: float64(len(status.UncommitedFiles)),
			TotalUntrackedFiles:  float64(len(status.UntrackedFiles)),
			TotalUnpushedCommits: float64(len(status.UnpushedCommits)),
			UncommitedFiles:      limit(status.UncommitedFiles),
			UntrackedFiles:       limit(status.UntrackedFiles),
			UnpushedCommits:      limit(status.UnpushedCommits),
		}
	}

	if updateContext.lastSuccessfullStatus != nil && reflect.DeepEqual(updateContext.lastSuccessfullStatus, newStatus) {
		return
	}

	err = s.gitpodService.UpdateGitStatus(ctx, newStatus)
	if err != nil {
		log.WithError(err).Error("git: error updating repo status")
		time.Sleep(updateContext.updateBackoff.NextBackOff())
		return
	}
	updateContext.lastSuccessfullStatus = newStatus
	updateContext.updateBackoff.Reset()
}
