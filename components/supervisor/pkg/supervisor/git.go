// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"fmt"
	"os/exec"
	"strings"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

// GitTokenProvider provides tokens for Git hosting services by asking
// the Gitpod server.
type GitTokenProvider struct {
	notificationService *NotificationService
	workspaceConfig     WorkspaceConfig
	gitpodAPI           gitpod.APIInterface
}

// NewGitTokenProvider creates a new instance of gitTokenProvider.
func NewGitTokenProvider(gitpodAPI gitpod.APIInterface, workspaceConfig WorkspaceConfig, notificationService *NotificationService) *GitTokenProvider {
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
			gpPath, err := exec.LookPath("gp")
			if err != nil {
				return nil, err
			}
			gpCmd := exec.Command(gpPath, "preview", "--external", p.workspaceConfig.GitpodHost+"/access-control")
			gpCmd = runAsGitpodUser(gpCmd)
			err = gpCmd.Start()
			if err != nil {
				return nil, err
			}
			err = gpCmd.Process.Release()
			if err != nil {
				return nil, err
			}
		}
		return nil, nil
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

func getMissingScopes(required []string, provided map[string]struct{}) []string {
	var missing []string
	for _, r := range required {
		if _, found := provided[r]; !found {
			missing = append(missing, r)
		}
	}
	return missing
}
