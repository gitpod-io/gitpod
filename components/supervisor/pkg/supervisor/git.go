// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"time"

	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/gitpod"
)

// GitTokenProvider provides tokens for Git hosting services by asking
// the Gitpod server.
type GitTokenProvider struct {
	gitpodAPI gitpod.APIInterface
}

// NewGitTokenProvider creates a new instance of gitTokenProvider
func NewGitTokenProvider(gitpodAPI gitpod.APIInterface) *GitTokenProvider {
	return &GitTokenProvider{
		gitpodAPI: gitpodAPI,
	}
}

// GetToken resolves a token from a git hosting service
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
	var expiryDate *time.Time
	if token.ExpiryDate != "" {
		t, err := time.Parse(time.RFC3339Nano, token.ExpiryDate)
		if err != nil {
			return nil, err
		}
		expiryDate = &t
	}
	return &Token{
		User:       token.Username,
		Token:      token.Value,
		Host:       req.Host,
		Scope:      scopes,
		ExpiryDate: expiryDate,
		Reuse:      api.TokenReuse_REUSE_WHEN_POSSIBLE,
	}, nil
}
