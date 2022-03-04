// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:build linux && amd64
// +build linux,amd64

package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"testing"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp"
)

func TestValidateToken(t *testing.T) {
	tkn := "foo"
	hash := sha256.Sum256([]byte(tkn))
	tokenHash := hex.EncodeToString(hash[:])

	unauthorizedErr := &gitpod.ErrBadHandshake{
		Resp: &http.Response{
			StatusCode: 401,
		},
	}

	forbiddenErr := errors.New("jsonrpc2: code 403 message: getGitpodTokenScopes")

	tests := []struct {
		Desc        string
		Scopes      []string
		ScopesErr   error
		Expectation error
	}{
		{
			Desc:        "invalid: unauthorized",
			ScopesErr:   unauthorizedErr,
			Expectation: &ErrInvalidGitpodToken{unauthorizedErr},
		},
		{
			Desc:        "invalid: forbidden",
			ScopesErr:   forbiddenErr,
			Expectation: &ErrInvalidGitpodToken{forbiddenErr},
		},
		{
			Desc:        "invalid: missing scopes",
			Scopes:      []string{"function:getWorkspace"},
			Expectation: &ErrInvalidGitpodToken{errors.New("function:getGitpodTokenScopes scope is missing in [function:getWorkspace]")},
		},
		{
			Desc:   "valid",
			Scopes: authScopes,
		},
	}
	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			gitpodAPI := gitpod.NewMockAPIInterface(ctrl)
			gitpodAPI.EXPECT().GetGitpodTokenScopes(context.Background(), tokenHash).Times(1).Return(test.Scopes, test.ScopesErr)

			var expectation string
			if test.Expectation != nil {
				expectation = test.Expectation.Error()
			}

			var actual string
			err := ValidateToken(gitpodAPI, tkn)
			if err != nil {
				actual = err.Error()
			}

			if diff := cmp.Diff(expectation, actual); diff != "" {
				t.Errorf("unexpected output (-want +got):\n%s", diff)
			}
		})
	}
}
