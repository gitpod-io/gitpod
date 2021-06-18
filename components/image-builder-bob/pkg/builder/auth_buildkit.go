// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

// copied from https://github.com/moby/buildkit/blob/master/session/auth/authprovider/authprovider.go

package builder

import (
	"context"
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"time"

	authutil "github.com/containerd/containerd/remotes/docker/auth"
	remoteserrors "github.com/containerd/containerd/remotes/errors"
	"github.com/moby/buildkit/session/auth"
	"github.com/pkg/errors"
	"golang.org/x/crypto/nacl/sign"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func (ap *authProvider) FetchToken(ctx context.Context, req *auth.FetchTokenRequest) (rr *auth.FetchTokenResponse, err error) {
	creds, err := ap.credentials(req.Host)
	if err != nil {
		return nil, err
	}

	to := authutil.TokenOptions{
		Realm:    req.Realm,
		Service:  req.Service,
		Scopes:   req.Scopes,
		Username: creds.Username,
		Secret:   creds.Secret,
	}

	if creds.Secret != "" {
		defer func() {
			err = errors.Wrap(err, "failed to fetch oauth token")
		}()
		// try GET first because Docker Hub does not support POST
		// switch once support has landed
		resp, err := authutil.FetchToken(ctx, http.DefaultClient, nil, to)
		if err != nil {
			var errStatus remoteserrors.ErrUnexpectedStatus
			if errors.As(err, &errStatus) {
				// retry with POST request
				// As of September 2017, GCR is known to return 404.
				// As of February 2018, JFrog Artifactory is known to return 401.
				if (errStatus.StatusCode == 405 && to.Username != "") || errStatus.StatusCode == 404 || errStatus.StatusCode == 401 {
					resp, err := authutil.FetchTokenWithOAuth(ctx, http.DefaultClient, nil, "buildkit-client", to)
					if err != nil {
						return nil, err
					}

					return toTokenResponse(resp.AccessToken, resp.IssuedAt, resp.ExpiresIn), nil
				}
			}
			return nil, err
		}
		return toTokenResponse(resp.Token, resp.IssuedAt, resp.ExpiresIn), nil
	}
	// do request anonymously
	resp, err := authutil.FetchToken(ctx, http.DefaultClient, nil, to)
	if err != nil {
		return nil, errors.Wrap(err, "failed to fetch anonymous token")
	}
	return toTokenResponse(resp.Token, resp.IssuedAt, resp.ExpiresIn), nil
}

func (ap *authProvider) Credentials(ctx context.Context, req *auth.CredentialsRequest) (*auth.CredentialsResponse, error) {
	resp, err := ap.credentials(req.Host)
	return resp, err
}

func (ap *authProvider) GetTokenAuthority(ctx context.Context, req *auth.GetTokenAuthorityRequest) (*auth.GetTokenAuthorityResponse, error) {
	key, err := ap.getAuthorityKey(req.Host, req.Salt)
	if err != nil {
		return nil, err
	}

	return &auth.GetTokenAuthorityResponse{PublicKey: key[32:]}, nil
}

func (ap *authProvider) VerifyTokenAuthority(ctx context.Context, req *auth.VerifyTokenAuthorityRequest) (*auth.VerifyTokenAuthorityResponse, error) {
	key, err := ap.getAuthorityKey(req.Host, req.Salt)
	if err != nil {
		return nil, err
	}

	priv := new([64]byte)
	copy((*priv)[:], key)

	return &auth.VerifyTokenAuthorityResponse{Signed: sign.Sign(nil, req.Payload, priv)}, nil
}

func (ap *authProvider) getAuthorityKey(host string, salt []byte) (ed25519.PrivateKey, error) {
	if v, err := strconv.ParseBool(os.Getenv("BUILDKIT_NO_CLIENT_TOKEN")); err == nil && v {
		return nil, status.Errorf(codes.Unavailable, "client side tokens disabled")
	}

	creds, err := ap.credentials(host)
	if err != nil {
		return nil, err
	}

	var seed []byte
	if s, ok := ap.seeds[host]; ok {
		seed = s
	} else {
		seed = make([]byte, 16)
		_, _ = rand.Read(seed)
		ap.seeds[host] = seed
	}

	mac := hmac.New(sha256.New, salt)
	if creds.Secret != "" {
		mac.Write(seed)
		enc := json.NewEncoder(mac)
		enc.Encode(creds)
	}

	sum := mac.Sum(nil)

	return ed25519.NewKeyFromSeed(sum[:ed25519.SeedSize]), nil
}

func toTokenResponse(token string, issuedAt time.Time, expires int) *auth.FetchTokenResponse {
	resp := &auth.FetchTokenResponse{
		Token:     token,
		ExpiresIn: int64(expires),
	}
	if !issuedAt.IsZero() {
		resp.IssuedAt = issuedAt.Unix()
	}
	return resp
}
