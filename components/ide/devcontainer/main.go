// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/sirupsen/logrus"
)

var (
	// ServiceName is the name we use for tracing/logging.
	ServiceName = "devcontainer-launcher"
	// Version of this service - set during build.
	Version = ""
)

func main() {
	log.Init(ServiceName, Version, true, os.Getenv("SUPERVISOR_DEBUG_ENABLE") == "true")

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		signals := make(chan os.Signal, 1)
		signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP)
		<-signals
		cancel()
	}()

	err := launch(ctx)
	if err != nil && ctx.Err() == nil {
		log.Fatal(err)
	}
}

func launch(ctx context.Context) error {
	cstate, wsInfo, err := resolveWorkspaceInfo(context.Background())
	if err != nil || wsInfo == nil {
		return err
	}

	var logLevel string
	switch log.Log.Logger.GetLevel() {
	case logrus.InfoLevel:
		logLevel = "info"
	case logrus.DebugLevel:
		logLevel = "debug"
	case logrus.TraceLevel:
		logLevel = "trace"
	}
	stdout := os.Stdout
	if logLevel == "" {
		stdout = nil
		logLevel = "info"
	}

	// TODO lifecycle commands
	// create: --skip-non-blocking-commands --skip-post-create
	// blocking: --skip-non-blocking-commands
	// commands: --skip-post-attach

	// TODO container, user and session folders?

	// TODO ssh
	// TODO dotfiles

	idLabel := "gitpod-devcontainer=1"
	var commonArgs []string
	commonArgs = append(commonArgs,
		"--workspace-folder", wsInfo.CheckoutLocation,
		"--log-level", logLevel,
		"--id-label", idLabel,
	)

	var envArgs []string
	for _, env := range os.Environ() {
		if env == "" {
			continue
		}
		parts := strings.SplitN(env, "=", 2)
		key := parts[0]
		if strings.HasPrefix(key, "THEIA_") ||
			strings.HasPrefix(key, "GITPOD_") ||
			strings.HasPrefix(key, "SUPERVISOR_") ||
			// TODO IDE - get rid of env vars in images, use supervisor api as a mediator to support many IDEs running in the same worksapce?
			// TODO PATH - use well defined locations to pick up binaries, i.e. /ide/bin or /ide-desktop/bin in supervisor?
			key == "LOG_LEVEL" ||
			key == "VSX_REGISTRY_URL" ||
			key == "EDITOR" ||
			key == "VISUAL" ||
			key == "GP_OPEN_EDITOR" ||
			key == "GIT_EDITOR" ||
			key == "GP_PREVIEW_BROWSER" ||
			key == "GP_EXTERNAL_BROWSER" ||
			key == "JETBRAINS_BACKEND_QUALIFIER" {
			envArgs = append(envArgs, "--remote-env", env)
		}
	}
	envCmd := exec.CommandContext(ctx, "gp", "env")
	reader, err := envCmd.StdoutPipe()
	if err != nil {
		return err
	}
	err = envCmd.Start()
	if err != nil {
		return err
	}
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		envArgs = append(envArgs, "--remote-env", scanner.Text())
	}

	var readArgs []string
	readArgs = append(readArgs,
		"/ide/devcontainer/node_modules/.bin/devcontainer", "read-configuration",
		"--include-merged-configuration",
	)
	readArgs = append(readArgs, commonArgs...)
	log.WithField("args", readArgs).Debug("read")
	readCmd := exec.CommandContext(ctx, "/ide/devcontainer/node_modules/node/bin/node", readArgs...)
	reader, err = readCmd.StdoutPipe()
	if err != nil {
		return err
	}
	err = readCmd.Start()
	if err != nil {
		return err
	}

	var config ReadConfig
	err = json.NewDecoder(reader).Decode(&config)
	if err != nil {
		return err
	}

	tmpDir, err := os.MkdirTemp("", "gitpod-devcontainer-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)
	configFile := filepath.Join(tmpDir, "devcontainer.json")

	getConfig := func(p string, v any) error {
		if raw, ok := config.Configuration[p]; ok {
			return json.Unmarshal(raw, v)
		}
		return nil
	}
	setConfig := func(p string, v any) error {
		data, err := json.Marshal(v)
		if err != nil {
			return err
		}
		config.Configuration[p] = json.RawMessage(data)
		return nil
	}

	var runArgs []string
	err = getConfig("runArgs", &runArgs)
	if err != nil {
		return err
	}
	runArgs = append(runArgs, "--network", "host")
	err = setConfig("runArgs", runArgs)
	if err != nil {
		return err
	}
	err = setConfig("workspaceMount", "source=/workspace,target=/workspace,type=bind")
	if err != nil {
		return err
	}
	err = setConfig("workspaceFolder", "${localWorkspaceFolder}")
	if err != nil {
		return err
	}

	data, err := json.Marshal(config.Configuration)
	if err != nil {
		return err
	}
	err = os.WriteFile(configFile, data, 0644)
	if err != nil {
		return err
	}

	commonArgs = append(commonArgs, "--override-config", configFile)
	commonArgs = append(commonArgs, envArgs...)

	if os.Args[1] == "probe" {
		var probeArgs []string
		probeArgs = append(probeArgs, "/ide/devcontainer/node_modules/.bin/devcontainer", "exec")
		probeArgs = append(probeArgs, commonArgs...)
		probeArgs = append(probeArgs, "true")
		log.WithField("args", probeArgs).Debug("probe")
		probeCmd := exec.CommandContext(ctx, "/ide/devcontainer/node_modules/node/bin/node", probeArgs...)
		probeCmd.Stdout = stdout
		probeCmd.Stderr = os.Stderr
		return probeCmd.Run()
	}

	prebuild := os.Args[1] == "prebuild"
	if os.Args[1] == "up" || prebuild {
		var upArgs []string
		upArgs = append(upArgs,
			"/ide/devcontainer/node_modules/.bin/devcontainer", "up",
			"--remove-existing-container",
			"--mount", "type=bind,source=/ide,target=/ide",
			"--mount", "type=bind,source=/usr/bin/gp,target=/usr/bin/gp",
		)
		upArgs = append(upArgs, commonArgs...)
		if prebuild {
			upArgs = append(upArgs, "--prebuild")
		}
		log.WithField("args", upArgs).Debug("up")
		upCmd := exec.CommandContext(ctx, "/ide/devcontainer/node_modules/node/bin/node", upArgs...)
		upCmd.Stdout = stdout
		upCmd.Stderr = os.Stderr
		err = upCmd.Run()
		if err != nil {
			return err
		}

		defer func() {
			id, err := exec.Command("/.supervisor/gitpod-docker-cli", "ps", "-aq", "--filter", "label="+idLabel).CombinedOutput()
			if err != nil {
				log.Error(err)
			}
			exec.Command("/.supervisor/gitpod-docker-cli", "rm", "-f", strings.TrimSpace(string(id))).Run()
		}()

		if prebuild {
			return nil
		}
		<-ctx.Done()
		return nil
	}

	var startArgs []string
	startArgs = append(startArgs, "/ide/devcontainer/node_modules/.bin/devcontainer", "exec")
	startArgs = append(startArgs, commonArgs...)
	startArgs = append(startArgs, os.Args[1:]...)
	if os.Args[1] == "/ide/codehelper" && cstate.Source != supervisor.ContentSource_from_backup {
		settings := make(map[string]any)
		dataDir := "/workspace/.vscode-remote/data/Machine"
		settingsFile := dataDir + "/settings.json"

		data, err := os.ReadFile(settingsFile)
		if err != nil {
			if os.IsNotExist(err) {
				err = os.MkdirAll(dataDir, 0700)
				if err != nil {
					return err
				}
			} else {
				return err
			}
		} else {
			data = bytes.TrimSpace(data)
			if len(data) > 0 {
				err = json.Unmarshal(data, &settings)
				if err != nil {
					return err
				}
			}
		}

		uniqMap := map[string]struct{}{}
		for _, customization := range config.MergedConfiguration.Customizations.VSCode {
			for _, extension := range customization.Extensions {
				if _, ok := uniqMap[extension]; ok {
					continue
				}
				uniqMap[extension] = struct{}{}
				startArgs = append(startArgs, "--install-extension", extension)
			}
			for name, value := range customization.Settings {
				settings[name] = value
			}
		}

		if len(settings) != 0 {
			data, err = json.Marshal(settings)
			if err != nil {
				return err
			}
			err = os.WriteFile(settingsFile, data, 0644)
			if err != nil {
				return err
			}
		}
	}
	log.WithField("args", startArgs).Debug("start")
	startCmd := exec.CommandContext(ctx, "/ide/devcontainer/node_modules/node/bin/node", startArgs...)
	startCmd.Stdout = stdout
	startCmd.Stderr = os.Stderr
	return startCmd.Run()
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

type ReadConfig struct {
	Configuration       map[string]json.RawMessage `json:"configuration"`
	MergedConfiguration struct {
		RemoteUser     string `json:"remoteUser"`
		Customizations struct {
			VSCode []struct {
				Extensions []string       `json:"extensions"`
				Settings   map[string]any `json:"settings"`
			} `json:"vscode"`
		} `json:"customizations"`
	} `json:"mergedConfiguration"`
}
