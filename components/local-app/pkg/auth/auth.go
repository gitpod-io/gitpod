// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package auth

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"

	"github.com/zalando/go-keyring"
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
	GitpodURL string
}

// Login walks through the login flow for obtaining a Gitpod token
func Login(ctx context.Context, opts LoginOpts) (token string, err error) {
	rl, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		return "", err
	}
	defer rl.Close()

	var (
		ec = make(chan error, 1)
		tc = make(chan string, 1)
	)

	returnHandler := func(rw http.ResponseWriter, req *http.Request) {
		tc <- req.URL.Query().Get("ots")
	}

	returnServer := &http.Server{
		Addr:    "localhost:0",
		Handler: http.HandlerFunc(returnHandler),
	}
	go func() {
		err := returnServer.Serve(rl)
		if err != nil {
			ec <- err
		}
	}()
	//nolint:staticcheck
	defer returnServer.Shutdown(ctx)

	baseURL := opts.GitpodURL
	if baseURL == "" {
		baseURL = "https://gitpod.io"
	}
	reqURL, err := url.Parse(baseURL)
	if err != nil {
		return "", err
	}
	reqURL.Path = "/api/auth/local-app"
	q := reqURL.Query()
	q.Set("returnTo", fmt.Sprintf("localhost:%d", rl.Addr().(*net.TCPAddr).Port))
	reqURL.RawQuery = q.Encode()
	err = openBrowser(reqURL.String())
	if err != nil {
		fmt.Printf("Cannot open browswer. Please visit %s\n", reqURL.String())
		err = nil
	}

	var ots string
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case err = <-ec:
		return "", err
	case ots = <-tc:
	}

	otsReq, err := http.NewRequest("GET", ots, nil)
	if err != nil {
		return "", err
	}
	otsReq = otsReq.WithContext(ctx)
	otsResp, err := http.DefaultClient.Do(otsReq)
	if err != nil {
		return "", err
	}
	body := otsResp.Body
	defer body.Close()
	tkn, err := io.ReadAll(body)
	if err != nil {
		return "", err
	}
	token = string(tkn)

	err = keyring.Set(keyringService, baseURL, token)
	if err != nil {
		return "", err
	}

	return token, nil
}

func openBrowser(url string) error {
	if cmd := os.Getenv("BROWSER"); cmd != "" {
		return exec.Command(cmd, url).Start()
	}

	switch runtime.GOOS {
	case "linux":
		return exec.Command("xdg-open", url).Start()
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		return exec.Command("open", url).Start()
	default:
		return fmt.Errorf("unsupported platform")
	}
}
