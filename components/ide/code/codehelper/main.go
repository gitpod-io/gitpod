// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"google.golang.org/grpc"
	yaml "gopkg.in/yaml.v2"

	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
)

var (
	// ServiceName is the name we use for tracing/logging.
	ServiceName = "codehelper"
	// Version of this service - set during build.
	Version = ""
)

const Code = "/ide/bin/gitpod-code"

func main() {
	log.Init(ServiceName, Version, true, false)
	startTime := time.Now()

	log.Info("wait until content available")

	// wait until content ready
	contentStatus, wsInfo, err := resolveWorkspaceInfo(context.Background())
	if err != nil || wsInfo == nil || contentStatus == nil || !contentStatus.Available {
		log.WithError(err).WithField("wsInfo", wsInfo).WithField("cstate", contentStatus).Error("resolve workspace info failed")
		return
	}
	log.WithField("cost", time.Now().Local().Sub(startTime).Milliseconds()).Info("content available")

	// code server args install extension with id
	args := []string{"--start-server"}

	// install extension with filepath
	extPathArgs := []string{}

	if os.Getenv("SUPERVISOR_DEBUG_ENABLE") == "true" {
		args = append(args, "--inspect", "--log=trace")
	}

	wsContextUrl := wsInfo.GetWorkspaceContextUrl()
	if ctxUrl, err := url.Parse(wsContextUrl); err == nil {
		if ctxUrl.Host == "github.com" {
			log.Info("ws context url is from github.com, install builtin extension github.vscode-pull-request-github")
			args = append(args, "--install-builtin-extension", "github.vscode-pull-request-github")
		}
	} else {
		log.WithError(err).WithField("wsContextUrl", wsContextUrl).Error("parse ws context url failed")
	}

	uniqMap := map[string]struct{}{}
	extensions, err := getExtensions(wsInfo.GetCheckoutLocation())
	if err != nil {
		log.WithError(err).Error("get extensions failed")
	}
	log.WithField("ext", extensions).Info("get extensions")
	for _, ext := range extensions {
		if _, ok := uniqMap[ext.Location]; ok {
			continue
		}
		uniqMap[ext.Location] = struct{}{}
		if !ext.IsUrl {
			args = append(args, "--install-extension", ext.Location)
		} else {
			extPathArgs = append(extPathArgs, "--install-extension", ext.Location)
		}
	}

	// install path extension first
	// see https://github.com/microsoft/vscode/issues/143617#issuecomment-1047881213
	if len(extPathArgs) > 0 {
		// ensure extensions install in correct dir
		extPathArgs = append(extPathArgs, os.Args[1:]...)
		extPathArgs = append(extPathArgs, "--do-not-sync")
		log.Info("installing extensions by path")
		cmd := exec.Command(Code, extPathArgs...)
		cmd.Stderr = os.Stderr
		cmd.Stdout = os.Stdout
		if err := cmd.Run(); err != nil {
			log.WithError(err).Error("installing extensions by path failed")
		}
		log.WithField("cost", time.Now().Local().Sub(startTime).Milliseconds()).Info("extensions with path installed")
	}

	args = append(args, os.Args[1:]...)
	args = append(args, "--do-not-sync")
	log.WithField("cost", time.Now().Local().Sub(startTime).Milliseconds()).Info("starting server")
	cmd := exec.Command(Code, args...)
	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout
	if err := cmd.Run(); err != nil {
		log.WithError(err).Error("install ext and start code server failed")
	}
}

func resolveWorkspaceInfo(ctx context.Context) (*supervisor.ContentStatusResponse, *supervisor.WorkspaceInfoResponse, error) {
	resolve := func(ctx context.Context) (contentStatus *supervisor.ContentStatusResponse, wsInfo *supervisor.WorkspaceInfoResponse, err error) {
		supervisorAddr := os.Getenv("SUPERVISOR_ADDR")
		if supervisorAddr == "" {
			supervisorAddr = "localhost:22999"
		}
		supervisorConn, err := grpc.Dial(supervisorAddr, grpc.WithInsecure())
		if err != nil {
			err = errors.New("dial supervisor failed: " + err.Error())
			return
		}
		defer supervisorConn.Close()
		if wsInfo, err = supervisor.NewInfoServiceClient(supervisorConn).WorkspaceInfo(ctx, &supervisor.WorkspaceInfoRequest{}); err != nil {
			err = errors.New("get workspace info failed: " + err.Error())
			return
		}
		contentStatus, err = supervisor.NewStatusServiceClient(supervisorConn).ContentStatus(ctx, &supervisor.ContentStatusRequest{Wait: true})
		if err != nil {
			err = errors.New("get content available failed: " + err.Error())
		}
		return
	}
	// try resolve workspace info 10 times
	for attempt := 0; attempt < 10; attempt++ {
		if contentStatus, wsInfo, err := resolve(ctx); err != nil {
			log.WithError(err).Error("resolve workspace info failed")
			time.Sleep(1 * time.Second)
		} else {
			return contentStatus, wsInfo, err
		}
	}
	return nil, nil, errors.New("failed with attempt 10 times")
}

type Extension struct {
	IsUrl    bool   `json:"is_url"`
	Location string `json:"location"`
}

func getExtensions(repoRoot string) (extensions []Extension, err error) {
	if repoRoot == "" {
		err = errors.New("repoRoot is empty")
		return
	}
	data, err := os.ReadFile(filepath.Join(repoRoot, ".gitpod.yml"))
	if err != nil {
		// .gitpod.yml not exist is ok
		if errors.Is(err, os.ErrNotExist) {
			err = nil
			return
		}
		err = errors.New("read .gitpod.yml file failed: " + err.Error())
		return
	}
	var config *gitpod.GitpodConfig
	if err = yaml.Unmarshal(data, &config); err != nil {
		err = errors.New("unmarshal .gitpod.yml file failed" + err.Error())
		return
	}
	if config == nil || config.Vscode == nil {
		err = errors.New("config.vscode field not exists: " + err.Error())
		return
	}
	var wg sync.WaitGroup
	var extensionsMu sync.Mutex
	for _, ext := range config.Vscode.Extensions {
		lowerCaseExtension := strings.ToLower(ext)
		if isUrl(lowerCaseExtension) {
			wg.Add(1)
			go func(url string) {
				defer wg.Done()
				location, err := downloadExtension(url)
				if err != nil {
					log.WithError(err).WithField("url", url).Error("download extension failed")
					return
				}
				extensionsMu.Lock()
				extensions = append(extensions, Extension{
					IsUrl:    true,
					Location: location,
				})
				extensionsMu.Unlock()
			}(ext)
		} else {
			extensionsMu.Lock()
			extensions = append(extensions, Extension{
				IsUrl:    false,
				Location: lowerCaseExtension,
			})
			extensionsMu.Unlock()
		}
	}
	wg.Wait()
	return
}

func isUrl(lowerCaseIdOrUrl string) bool {
	isUrl, _ := regexp.MatchString(`http[s]?://`, lowerCaseIdOrUrl)
	return isUrl
}

func downloadExtension(url string) (location string, err error) {
	start := time.Now()
	log.WithField("url", url).Info("start download extension")
	client := &http.Client{
		Timeout: 20 * time.Second,
	}
	resp, err := client.Get(url)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		err = errors.New("failed to download extension: " + http.StatusText(resp.StatusCode))
		return
	}
	out, err := os.CreateTemp("", "vsix*.vsix")
	if err != nil {
		err = errors.New("failed to create tmp vsix file: " + err.Error())
		return
	}
	defer out.Close()
	if _, err = io.Copy(out, resp.Body); err != nil {
		err = errors.New("failed to resolve body stream: " + err.Error())
		return
	}
	location = out.Name()
	log.WithField("url", url).WithField("location", location).
		WithField("cost", time.Now().Local().Sub(start).Milliseconds()).
		Info("download extension success")
	return
}
