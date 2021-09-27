// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package builder

import (
	"encoding/json"

	"github.com/moby/buildkit/session"
	"github.com/moby/buildkit/session/auth"
	"google.golang.org/grpc"
)

// authConfig configures authentication for a single host
type authConfig struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type authorizerImpl map[string]authConfig

func (a authorizerImpl) Authorize(host string) (user, pass string, err error) {
	res, ok := a[host]
	if !ok {
		return "", "", nil
	}
	return res.Username, res.Password, nil
}

type Authorizer interface {
	Authorize(host string) (user, pass string, err error)
}

func NewAuthorizerFromEnvVar(content string) (auth Authorizer, err error) {
	var res map[string]authConfig
	err = json.Unmarshal([]byte(content), &res)
	if err != nil {
		return
	}
	return authorizerImpl(res), nil
}

func newAuthProviderFromEnvvar(content string) (at session.Attachable, err error) {
	var res map[string]authConfig
	err = json.Unmarshal([]byte(content), &res)
	if err != nil {
		return
	}

	return &authProvider{
		res:   res,
		seeds: make(map[string][]byte),
	}, nil
}

type authProvider struct {
	res   map[string]authConfig
	seeds map[string][]byte
}

func (ap *authProvider) credentials(host string) (*auth.CredentialsResponse, error) {
	if host == "registry-1.docker.io" {
		host = "https://index.docker.io/v1/"
	}
	ac, ok := ap.res[host]
	res := &auth.CredentialsResponse{}
	if ok {
		res.Username = ac.Username
		res.Secret = ac.Password
	}
	return res, nil
}

func (ap *authProvider) Register(server *grpc.Server) {
	auth.RegisterAuthServer(server, ap)
}
