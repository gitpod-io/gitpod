// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	yaml "gopkg.in/yaml.v2"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/sirupsen/logrus"
)

var (
	// ServiceName is the name we use for tracing/logging.
	ServiceName = "codehelper"
	// Version of this service - set during build.
	Version = ""
)

const (
	Code                     = "/ide/bin/gitpod-code"
	ProductJsonLocation      = "/ide/product.json"
	WebWorkbenchMainLocation = "/ide/out/vs/workbench/workbench.web.main.js"
	ServerMainLocation       = "/ide/out/vs/server/node/server.main.js"
)

func main() {
	enableDebug := os.Getenv("SUPERVISOR_DEBUG_ENABLE") == "true"

	log.Init(ServiceName, Version, true, enableDebug)
	log.Info("codehelper started")
	startTime := time.Now()

	if err := replaceOpenVSXUrl(); err != nil {
		log.WithError(err).Error("failed to replace OpenVSX URL")
	}

	phaseDone := phaseLogging("ResolveWsInfo")
	cstate, wsInfo, err := resolveWorkspaceInfo(context.Background())
	if err != nil || wsInfo == nil {
		log.WithError(err).WithField("wsInfo", wsInfo).Error("resolve workspace info failed")
		return
	}
	phaseDone()

	url, err := url.Parse(wsInfo.GitpodHost)
	if err != nil {
		log.WithError(err).Errorf("failed to parse GitpodHost %s", wsInfo.GitpodHost)
		return
	}
	domain := url.Hostname()

	if wsInfo.DebugWorkspaceType != supervisor.DebugWorkspaceType_noDebug {
		// TODO actually should be performed always
		// the better way would be to apply replacements during a workspace start
		// to aling with content in blobserve
		if err := prepareWebWorkbenchMain(domain); err != nil {
			log.WithError(err).Error("failed to prepare web workbench")
		}
		if err := prepareServerMain(domain); err != nil {
			log.WithError(err).Error("failed to prepare server")
		}
	}

	// code server args install extension with id
	args := []string{}

	if enableDebug {
		args = append(args, "--inspect", "--log=trace")
	} else {
		switch log.Log.Logger.GetLevel() {
		case logrus.PanicLevel:
			args = append(args, "--log=critical")
		case logrus.FatalLevel:
			args = append(args, "--log=critical")
		case logrus.ErrorLevel:
			args = append(args, "--log=error")
		case logrus.WarnLevel:
			args = append(args, "--log=warn")
		case logrus.InfoLevel:
			args = append(args, "--log=info")
		case logrus.DebugLevel:
			args = append(args, "--log=debug")
		case logrus.TraceLevel:
			args = append(args, "--log=trace")
		}
	}

	args = append(args, "--install-builtin-extension", "gitpod.gitpod-theme")

	wsContextUrl := wsInfo.GetWorkspaceContextUrl()
	if ctxUrl, err := url.Parse(wsContextUrl); err == nil {
		if ctxUrl.Host == "github.com" {
			log.Info("ws context url is from github.com, install builtin extension github.vscode-pull-request-github")
			args = append(args, "--install-builtin-extension", "github.vscode-pull-request-github")
		}
	} else {
		log.WithError(err).WithField("wsContextUrl", wsContextUrl).Error("parse ws context url failed")
	}

	phaseDone = phaseLogging("GetExtensions")
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
		// don't install url extension for backup, see https://github.com/microsoft/vscode/issues/143617#issuecomment-1047881213
		if cstate.Source != supervisor.ContentSource_from_backup || !ext.IsUrl {
			args = append(args, "--install-extension", ext.Location)
		}
	}
	phaseDone()

	// install extensions and run code server with exec
	args = append(args, os.Args[1:]...)
	args = append(args, "--do-not-sync")
	args = append(args, "--start-server")
	cmdEnv := append(os.Environ(), fmt.Sprintf("GITPOD_CODE_HOST=%s", domain))
	log.WithField("cost", time.Now().Local().Sub(startTime).Milliseconds()).Info("starting server")
	if err := syscall.Exec(Code, append([]string{"gitpod-code"}, args...), cmdEnv); err != nil {
		log.WithError(err).Error("install ext and start code server failed")
	}
}

func resolveWorkspaceInfo(ctx context.Context) (*supervisor.ContentStatusResponse, *supervisor.WorkspaceInfoResponse, error) {
	resolve := func(ctx context.Context) (cstate *supervisor.ContentStatusResponse, wsInfo *supervisor.WorkspaceInfoResponse, err error) {
		supervisorConn, err := grpc.Dial(util.GetSupervisorAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			err = errors.New("dial supervisor failed: " + err.Error())
			return
		}
		defer supervisorConn.Close()
		if cstate, err = supervisor.NewStatusServiceClient(supervisorConn).ContentStatus(ctx, &supervisor.ContentStatusRequest{}); err != nil {
			err = errors.New("get content state failed: " + err.Error())
			return
		}
		if wsInfo, err = supervisor.NewInfoServiceClient(supervisorConn).WorkspaceInfo(ctx, &supervisor.WorkspaceInfoRequest{}); err != nil {
			err = errors.New("get workspace info failed: " + err.Error())
			return
		}
		return
	}
	// try resolve workspace info 10 times
	for attempt := 0; attempt < 10; attempt++ {
		if cstate, wsInfo, err := resolve(ctx); err != nil {
			log.WithError(err).Error("resolve workspace info failed")
			time.Sleep(1 * time.Second)
		} else {
			return cstate, wsInfo, err
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
		return
	}
	for _, ext := range config.Vscode.Extensions {
		lowerCaseExtension := strings.ToLower(ext)
		if isUrl(lowerCaseExtension) {
			extensions = append(extensions, Extension{
				IsUrl:    true,
				Location: ext,
			})
		} else {
			extensions = append(extensions, Extension{
				IsUrl:    false,
				Location: lowerCaseExtension,
			})
		}
	}
	return
}

func isUrl(lowerCaseIdOrUrl string) bool {
	isUrl, _ := regexp.MatchString(`http[s]?://`, lowerCaseIdOrUrl)
	return isUrl
}

func phaseLogging(phase string) context.CancelFunc {
	ctx, cancel := context.WithCancel(context.Background())
	start := time.Now()
	log.WithField("phase", phase).Info("phase start")
	go func() {
		<-ctx.Done()
		duration := time.Now().Local().Sub(start).Seconds()
		log.WithField("phase", phase).WithField("duration", duration).Info("phase end")
	}()
	return cancel
}

func replaceOpenVSXUrl() error {
	phase := phaseLogging("ReplaceOpenVSXUrl")
	defer phase()
	b, err := os.ReadFile(ProductJsonLocation)
	if err != nil {
		return errors.New("failed to read product.json: " + err.Error())
	}
	b = replaceOpenVSX(b)
	if err := os.WriteFile(ProductJsonLocation, b, 0644); err != nil {
		return errors.New("failed to write product.json: " + err.Error())
	}
	return nil
}

// TODO it is be applied as well by blobserve if served for regular workspace location
// reconsider how to configure in all modes, i.e. regular, debug, dev
func prepareWebWorkbenchMain(domain string) error {
	phase := phaseLogging("prepareWebWorkbenchMain")
	defer phase()
	b, err := os.ReadFile(WebWorkbenchMainLocation)
	if err != nil {
		return errors.New("failed to read " + WebWorkbenchMainLocation + ": " + err.Error())
	}
	b = bytes.ReplaceAll(b, []byte("vscode-cdn.net"), []byte(domain))
	b = bytes.ReplaceAll(b, []byte("ide.gitpod.io/code/markeplace.json"), []byte(fmt.Sprintf("ide.%s/code/marketplace.json", domain)))

	b = replaceOpenVSX(b)

	if err := os.WriteFile(WebWorkbenchMainLocation, b, 0644); err != nil {
		return errors.New("failed to write " + WebWorkbenchMainLocation + ": " + err.Error())
	}
	return nil
}

func prepareServerMain(domain string) error {
	phase := phaseLogging("prepareServerMain")
	defer phase()
	b, err := os.ReadFile(ServerMainLocation)
	if err != nil {
		return errors.New("failed to read " + ServerMainLocation + ": " + err.Error())
	}
	b = bytes.ReplaceAll(b, []byte("https://*.vscode-cdn.net"), []byte(fmt.Sprintf("https://%s https://*.%s", domain, domain)))
	if err := os.WriteFile(ServerMainLocation, b, 0644); err != nil {
		return errors.New("failed to write " + ServerMainLocation + ": " + err.Error())
	}
	return nil
}

func replaceOpenVSX(b []byte) []byte {
	registryUrl := os.Getenv("VSX_REGISTRY_URL")
	if registryUrl != "" {
		b = bytes.ReplaceAll(b, []byte("https://open-vsx.org"), []byte(registryUrl))
	}
	b = bytes.ReplaceAll(b, []byte("{{extensionsGalleryItemUrl}}"), []byte("https://open-vsx.org/vscode/item"))
	return bytes.ReplaceAll(b, []byte("{{trustedDomain}}"), []byte("https://open-vsx.org"))
}
