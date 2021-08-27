// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package auth

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"

	jwt "github.com/dgrijalva/jwt-go"
	"github.com/sirupsen/logrus"
	"github.com/skratchdot/open-golang/open"
	keyring "github.com/zalando/go-keyring"
	"golang.org/x/oauth2"
	"golang.org/x/xerrors"
)

const (
	keyringService = "gitpod-io"
)

// SetToken returns the persisted Gitpod token
func SetToken(host, token string) error {
	return keyring.Set(keyringService, host, token)
}

// GetToken returns the persisted Gitpod token
func GetToken(host string) (token string, err error) {
	return keyring.Get(keyringService, host)
}

// LoginOpts configure the login process
type LoginOpts struct {
	GitpodURL   string
	RedirectURL string
}

const html = `
<html>
	<head>
    	<meta charset="utf-8">
    	<title>Done</title>
		<script>
			if (window.opener) {
				const message = new URLSearchParams(window.location.search).get("message");
				window.opener.postMessage(message, "https://${window.location.hostname}");
			} else {
				console.log("This page was not opened by Gitpod.")
				setTimeout("window.close();", 1000);
			}
		</script>
	</head>
	<body>
		If this tab is not closed automatically, feel free to close it and proceed. <button type="button" onclick="window.open('', '_self', ''); window.close();">Close</button>
	</body>
</html>`

// NOTE: the port ranges all need to be valid redirect URI's in the backend
const STARTING_PORT_NUM = 63110
const ENDING_PORT_NUM = 63120

// Login walks through the login flow for obtaining a Gitpod token
func Login(ctx context.Context, opts LoginOpts) (token string, err error) {
	// Try a range of ports for local redirect server
	var rl net.Listener
	var port int
	for port = STARTING_PORT_NUM; port < ENDING_PORT_NUM || rl == nil; port++ {
		rl, err = net.Listen("tcp4", fmt.Sprintf("127.0.0.1:%d", port))
		if err != nil {
			logrus.Infof("Could not open port:%d got error:%s\nTrying next port\n", port, err)
			continue
		}
		defer rl.Close()
	}
	if rl == nil {
		return "", xerrors.Errorf("could not open any valid port in range %d - %d", STARTING_PORT_NUM, ENDING_PORT_NUM)
	}

	var (
		errChan   = make(chan error, 1)
		queryChan = make(chan url.Values, 1)
	)

	returnHandler := func(rw http.ResponseWriter, req *http.Request) {
		queryChan <- req.URL.Query()
		if opts.RedirectURL != "" {
			http.Redirect(rw, req, opts.RedirectURL, http.StatusSeeOther)
		} else {
			io.WriteString(rw, html)
		}
	}

	returnServer := &http.Server{
		Addr:    fmt.Sprintf("127.0.0.1:%d", port),
		Handler: http.HandlerFunc(returnHandler),
	}
	go func() {
		err := returnServer.Serve(rl)
		if err != nil {
			errChan <- err
		}
	}()
	defer returnServer.Shutdown(ctx)

	baseURL := opts.GitpodURL
	if baseURL == "" {
		baseURL = "https://gitpod.io"
	}
	reqURL, err := url.Parse(baseURL)
	if err != nil {
		return "", err
	}
	authURL := *reqURL
	authURL.Path = "/api/oauth/authorize"
	tokenURL := *reqURL
	tokenURL.Path = "/api/oauth/token"
	conf := &oauth2.Config{
		ClientID:     "gplctl-1.0",
		ClientSecret: "gplctl-1.0-secret", // Required (even though it is marked as optional?!)
		Scopes: []string{
			"function:getWorkspace",
			"function:getWorkspaces",
			"function:listenForWorkspaceInstanceUpdates",
			"resource:workspace::*::get",
			"resource:workspaceInstance::*::get",
		},
		Endpoint: oauth2.Endpoint{
			AuthURL:  authURL.String(),
			TokenURL: tokenURL.String(),
		},
	}
	responseTypeParam := oauth2.SetAuthURLParam("response_type", "code")
	redirectURIParam := oauth2.SetAuthURLParam("redirect_uri", fmt.Sprintf("http://127.0.0.1:%d", rl.Addr().(*net.TCPAddr).Port))
	codeChallengeMethodParam := oauth2.SetAuthURLParam("code_challenge_method", "S256")
	codeVerifier := PKCEVerifier(84)
	codeChallengeParam := oauth2.SetAuthURLParam("code_challenge", PKCEChallenge(codeVerifier))

	// Redirect user to consent page to ask for permission
	// for the scopes specified above.
	authorizationURL := conf.AuthCodeURL("state", responseTypeParam, redirectURIParam, codeChallengeParam, codeChallengeMethodParam)

	// open a browser window to the authorizationURL
	err = open.Start(authorizationURL)
	if err != nil {
		return "", xerrors.Errorf("cannot open browser to URL %s: %s\n", authorizationURL, err)
	}

	var query url.Values
	var code, approved string
	select {
	case <-ctx.Done():
		return "", errors.New("context cancelled")
	case err = <-errChan:
		return "", err
	case query = <-queryChan:
		code = query.Get("code")
		approved = query.Get("approved")
	}

	if approved == "no" {
		return "", errors.New("client approval was not granted")
	}

	// Use the authorization code that is pushed to the redirect URL. Exchange will do the handshake to retrieve the
	// initial access token. We need to add the required PKCE params as well...
	// NOTE: we do not currently support refreshing so using the client from conf.Client will fail when token expires
	codeVerifierParam := oauth2.SetAuthURLParam("code_verifier", codeVerifier)
	tok, err := conf.Exchange(ctx, code, codeVerifierParam, redirectURIParam)
	if err != nil {
		return "", err
	}

	// Extract Gitpod token from OAuth token (JWT)
	// NOTE: we do not verify the token as that requires a shared secret
	//       ... which wouldn't be secret for a publicly accessible app
	claims := jwt.MapClaims{}
	parser := new(jwt.Parser)
	_, _, err = parser.ParseUnverified(tok.AccessToken, &claims)
	if err != nil {
		return "", err
	}

	gitpodToken := claims["jti"].(string)
	return gitpodToken, nil
}
