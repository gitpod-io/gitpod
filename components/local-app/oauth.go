// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/skratchdot/open-golang/open"
	"golang.org/x/oauth2"
)

// == PKCE
func PkceInit() {
	rand.Seed(time.Now().UnixNano())
}

//string of pkce allowed chars
func PkceVerifier(length int) string {
	if length > 128 {
		length = 128
	}
	if length < 43 {
		length = 43
	}
	const charset = "abcdefghijklmnopqrstuvwxyz" +
		"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

// base64-URL-encoded SHA256 hash of verifier, per rfc 7636
func PkceChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(sum[:])
	return (challenge)
}

func testOAuth(gitpodHost string) error {
	ctx := context.Background()
	PkceInit()

	rl, err := net.Listen("tcp", "localhost:64110")
	if err != nil {
		fmt.Printf("snap: can't listen: %s\n", err)
		os.Exit(1)
	}
	defer rl.Close()

	var (
		errChan   = make(chan error, 1)
		queryChan = make(chan url.Values, 1)
	)

	returnHandler := func(rw http.ResponseWriter, req *http.Request) {
		log.Printf("RETURN:%s\n", req.URL.Query())
		queryChan <- req.URL.Query()
		io.WriteString(rw, `
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
</html>`)
	}

	returnServer := &http.Server{
		Addr:    "localhost:0",
		Handler: http.HandlerFunc(returnHandler),
	}
	go func() {
		err := returnServer.Serve(rl)
		if err != nil {
			errChan <- err
		}
	}()
	defer returnServer.Shutdown(ctx)

	baseURL := gitpodHost
	if baseURL == "" {
		baseURL = "https://gitpod.io"
	}
	reqURL, err := url.Parse(baseURL)
	if err != nil {
		return err
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
	redirectURIParam := oauth2.SetAuthURLParam("redirect_uri", fmt.Sprintf("http://localhost:%d", rl.Addr().(*net.TCPAddr).Port))
	codeChallengeMethodParam := oauth2.SetAuthURLParam("code_challenge_method", "S256")
	codeVerifier := PkceVerifier(84)
	codeChallengeParam := oauth2.SetAuthURLParam("code_challenge", PkceChallenge(codeVerifier))

	// Redirect user to consent page to ask for permission
	// for the scopes specified above.
	authorizationURL := conf.AuthCodeURL("state", responseTypeParam, redirectURIParam, codeChallengeParam, codeChallengeMethodParam)
	fmt.Printf("URL for the auth: %v\n", authorizationURL)

	// open a browser window to the authorizationURL
	err = open.Start(authorizationURL)
	if err != nil {
		fmt.Printf("snap: can't open browser to URL %s: %s\n", authorizationURL, err)
		os.Exit(1)
	}

	var query url.Values
	var code, approved string
	select {
	case <-ctx.Done():
		fmt.Printf("DONE: %v\n", ctx.Err())
		os.Exit(1)
	case err = <-errChan:
		fmt.Printf("ERR: %v\n", err)
		os.Exit(1)
	case query = <-queryChan:
		code = query.Get("code")
		approved = query.Get("approved")
	}
	fmt.Printf("code: %s, approved:%s\n", code, approved)

	if approved == "no" {
		log.Println("Client approval was not granted... exiting")
		os.Exit(1)
	}

	// Use the authorization code that is pushed to the redirect
	// URL. Exchange will do the handshake to retrieve the
	// initial access token.
	// We need to add the required PKCE param as well...
	// NOTE: we do not currently support refreshing so using the client from conf.Client will fail when token expires (which technically it doesn't)
	codeVerifierParam := oauth2.SetAuthURLParam("code_verifier", codeVerifier)
	tok, err := conf.Exchange(ctx, code, codeVerifierParam, redirectURIParam)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("TOK: %#v\n", tok)

	// Extract Gitpod token from OAuth token (JWT)
	claims := jwt.MapClaims{}
	parser := new(jwt.Parser)
	gitpodToken, _, err := parser.ParseUnverified(tok.AccessToken, &claims)
	if err != nil {
		log.Fatal(err)
	}
	// gitpodToken, err := jwt.ParseWithClaims(tok.AccessToken, &claims, func(token *jwt.Token) (interface{}, error) {
	// 	return []byte("secret secret secret"), nil
	// })
	// if err != nil {
	// 	log.Fatal(err)
	// }
	// if !gitpodToken.Valid {
	// 	log.Println("OAuth2 token invalid... exiting")
	// 	os.Exit(1)
	// }

	log.Printf("Gitpod: %#v\n%#v\n", claims, gitpodToken)

	// client := conf.Client(ctx, tok)
	// client.Get("...")
	os.Exit(0)
	return nil
}
