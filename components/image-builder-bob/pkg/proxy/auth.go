// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"encoding/base64"
	"encoding/json"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
)

// authConfig configures authentication for a single host
type authConfig struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Auth     string `json:"auth"`
}

type authorizerImpl map[string]authConfig

func (a authorizerImpl) Authorize(host string) (user, pass string, err error) {
	defer func() {
		log.WithFields(logrus.Fields{
			"host": host,
			"user": user,
		}).Info("authorizing registry access")
	}()

	res, ok := a[host]
	if !ok {
		return
	}

	user, pass = res.Username, res.Password
	if res.Auth != "" {
		var auth []byte
		auth, err = base64.StdEncoding.DecodeString(res.Auth)
		if err != nil {
			return
		}
		segs := strings.Split(string(auth), ":")
		if len(segs) < 2 {
			return
		}

		user = segs[0]
		pass = strings.Join(segs[1:], ":")
	}

	return
}

type Authorizer interface {
	Authorize(host string) (user, pass string, err error)
}

func NewAuthorizerFromEnvVar(content string) (auth Authorizer, err error) {
	var res struct {
		Auths map[string]authConfig `json:"auths"`
	}
	err = json.Unmarshal([]byte(content), &res)
	if err != nil {
		return
	}
	return authorizerImpl(res.Auths), nil
}
