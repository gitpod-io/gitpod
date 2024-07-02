// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/hashicorp/go-version"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	yaml "gopkg.in/yaml.v2"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/jetbrains/launcher/pkg/constant"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
)

const defaultBackendPort = "63342"

var (
	// ServiceName is the name we use for tracing/logging.
	ServiceName = "jetbrains-launcher"
)

type LaunchContext struct {
	startTime time.Time

	port   string
	alias  string
	label  string
	warmup bool

	qualifier      string
	productDir     string
	backendDir     string
	info           *ProductInfo
	backendVersion *version.Version
	wsInfo         *supervisor.WorkspaceInfoResponse

	vmOptionsFile          string
	platformPropertiesFile string
	projectDir             string
	configDir              string
	systemDir              string
	projectContextDir      string
	riderSolutionFile      string

	env []string

	// Custom fields

	// shouldWaitBackendPlugin is controlled by env GITPOD_WAIT_IDE_BACKEND
	shouldWaitBackendPlugin bool
}

// JB startup entrypoint
func main() {
	if len(os.Args) == 3 && os.Args[1] == "env" && os.Args[2] != "" {
		var mark = os.Args[2]
		content, err := json.Marshal(os.Environ())
		exitStatus := 0
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s", err)
			exitStatus = 1
		}
		fmt.Printf("%s%s%s", mark, content, mark)
		os.Exit(exitStatus)
		return
	}

	// supervisor refer see https://github.com/gitpod-io/gitpod/blob/main/components/supervisor/pkg/supervisor/supervisor.go#L961
	shouldWaitBackendPlugin := os.Getenv("GITPOD_WAIT_IDE_BACKEND") == "true"
	debugEnabled := os.Getenv("SUPERVISOR_DEBUG_ENABLE") == "true"
	log.Init(ServiceName, constant.Version, true, debugEnabled)
	log.Info(ServiceName + ": " + constant.Version)
	startTime := time.Now()

	log.WithField("shouldWait", shouldWaitBackendPlugin).Info("should wait backend plugin")
	var port string
	var warmup bool

	if len(os.Args) < 2 {
		log.Fatalf("Usage: %s (warmup|<port>)\n", os.Args[0])
	}

	if os.Args[1] == "warmup" {
		if len(os.Args) < 3 {
			log.Fatalf("Usage: %s %s <alias>\n", os.Args[0], os.Args[1])
		}

		warmup = true
	} else {
		if len(os.Args) < 3 {
			log.Fatalf("Usage: %s <port> <kind> [<link label>]\n", os.Args[0])
		}

		port = os.Args[1]
	}

	alias := os.Args[2]
	label := "Open JetBrains IDE"
	if len(os.Args) > 3 {
		label = os.Args[3]
	}

	qualifier := os.Getenv("JETBRAINS_BACKEND_QUALIFIER")
	if qualifier == "stable" {
		qualifier = ""
	} else {
		qualifier = "-" + qualifier
	}
	productDir := "/ide-desktop/" + alias + qualifier
	backendDir := productDir + "/backend"

	info, err := resolveProductInfo(backendDir)
	if err != nil {
		log.WithError(err).Error("failed to resolve product info")
		return
	}

	backendVersion, err := version.NewVersion(info.Version)
	if err != nil {
		log.WithError(err).Error("failed to resolve backend version")
		return
	}

	wsInfo, err := resolveWorkspaceInfo(context.Background())
	if err != nil || wsInfo == nil {
		log.WithError(err).WithField("wsInfo", wsInfo).Error("resolve workspace info failed")
		return
	}

	launchCtx := &LaunchContext{
		startTime: startTime,

		warmup: warmup,
		port:   port,
		alias:  alias,
		label:  label,

		qualifier:               qualifier,
		productDir:              productDir,
		backendDir:              backendDir,
		info:                    info,
		backendVersion:          backendVersion,
		wsInfo:                  wsInfo,
		shouldWaitBackendPlugin: shouldWaitBackendPlugin,
	}

	if launchCtx.warmup {
		launch(launchCtx)
		return
	}

	err = configureToolboxCliProperties(backendDir)
	if err != nil {
		log.WithError(err).Error("failed to write toolbox cli config file")
		return
	}

	// we should start serving immediately and postpone launch
	// in order to enable a JB Gateway to connect as soon as possible
	go launch(launchCtx)
	// IMPORTANT: don't put startup logic in serve!!!
	serve(launchCtx)
}

func serve(launchCtx *LaunchContext) {
	debugAgentPrefix := "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:"
	http.HandleFunc("/debug", func(w http.ResponseWriter, r *http.Request) {
		options, err := readVMOptions(launchCtx.vmOptionsFile)
		if err != nil {
			log.WithError(err).Error("failed to configure debug agent")
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		debugPort := ""
		i := len(options) - 1
		for i >= 0 && debugPort == "" {
			option := options[i]
			if strings.HasPrefix(option, debugAgentPrefix) {
				debugPort = option[len(debugAgentPrefix):]
				if debugPort == "0" {
					debugPort = ""
				}
			}
			i--
		}

		if debugPort != "" {
			fmt.Fprint(w, debugPort)
			return
		}
		netListener, err := net.Listen("tcp", "localhost:0")
		if err != nil {
			log.WithError(err).Error("failed to configure debug agent")
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		debugPort = strconv.Itoa(netListener.(*net.TCPListener).Addr().(*net.TCPAddr).Port)
		_ = netListener.Close()

		debugOptions := []string{debugAgentPrefix + debugPort}
		options = deduplicateVMOption(options, debugOptions, func(l, r string) bool {
			return strings.HasPrefix(l, debugAgentPrefix) && strings.HasPrefix(r, debugAgentPrefix)
		})
		err = writeVMOptions(launchCtx.vmOptionsFile, options)
		if err != nil {
			log.WithError(err).Error("failed to configure debug agent")
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		fmt.Fprint(w, debugPort)
		restart(r)
	})
	http.HandleFunc("/restart", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "terminated")
		restart(r)
	})
	http.HandleFunc("/joinLink", func(w http.ResponseWriter, r *http.Request) {
		backendPort := r.URL.Query().Get("backendPort")
		if backendPort == "" {
			backendPort = defaultBackendPort
		}
		jsonLink, err := resolveJsonLink(backendPort)
		if err != nil {
			log.WithError(err).Error("cannot resolve join link")
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		fmt.Fprint(w, jsonLink)
	})
	http.HandleFunc("/joinLink2", func(w http.ResponseWriter, r *http.Request) {
		backendPort := r.URL.Query().Get("backendPort")
		if backendPort == "" {
			backendPort = defaultBackendPort
		}
		jsonResp, err := resolveJsonLink2(backendPort)
		if err != nil {
			log.WithError(err).Error("cannot resolve join link")
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		json.NewEncoder(w).Encode(jsonResp)
	})
	http.HandleFunc("/gatewayLink", func(w http.ResponseWriter, r *http.Request) {
		backendPort := r.URL.Query().Get("backendPort")
		if backendPort == "" {
			backendPort = defaultBackendPort
		}
		jsonLink, err := resolveGatewayLink(backendPort, launchCtx.wsInfo)
		if err != nil {
			log.WithError(err).Error("cannot resolve gateway link")
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		fmt.Fprint(w, jsonLink)
	})
	http.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		backendPort := r.URL.Query().Get("backendPort")
		if backendPort == "" {
			backendPort = defaultBackendPort
		}
		if err := isBackendPluginReady(r.Context(), backendPort, launchCtx.shouldWaitBackendPlugin); err != nil {
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		gatewayLink, err := resolveGatewayLink(backendPort, launchCtx.wsInfo)
		if err != nil {
			log.WithError(err).Error("cannot resolve gateway link")
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		response := make(map[string]string)
		response["link"] = gatewayLink
		response["label"] = launchCtx.label
		response["clientID"] = "jetbrains-gateway"
		response["kind"] = launchCtx.alias
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	})

	fmt.Printf("Starting status proxy for desktop IDE at port %s\n", launchCtx.port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", launchCtx.port), nil); err != nil {
		log.Fatal(err)
	}
}

// isBackendPluginReady checks if the backend plugin is ready via backend plugin CLI GitpodCLIService.kt
func isBackendPluginReady(ctx context.Context, backendPort string, shouldWaitBackendPlugin bool) error {
	if !shouldWaitBackendPlugin {
		log.Debug("will not wait plugin ready")
		return nil
	}
	log.WithField("backendPort", backendPort).Debug("wait backend plugin to be ready")
	// Use op=metrics so that we don't need to rebuild old backend-plugin
	url, err := url.Parse("http://localhost:" + backendPort + "/api/gitpod/cli?op=metrics")
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url.String(), nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("backend plugin is not ready: %d", resp.StatusCode)
	}
	return nil
}

func restart(r *http.Request) {
	backendPort := r.URL.Query().Get("backendPort")
	if backendPort == "" {
		backendPort = defaultBackendPort
	}
	err := terminateIDE(backendPort)
	if err != nil {
		log.WithError(err).Error("failed to terminate IDE gracefully")
		os.Exit(1)
	}
	os.Exit(0)
}

type Projects struct {
	JoinLink string `json:"joinLink"`
}
type Response struct {
	AppPid   int        `json:"appPid"`
	JoinLink string     `json:"joinLink"`
	Projects []Projects `json:"projects"`
}
type JoinLinkResponse struct {
	AppPid   int    `json:"appPid"`
	JoinLink string `json:"joinLink"`
}

func resolveGatewayLink(backendPort string, wsInfo *supervisor.WorkspaceInfoResponse) (string, error) {
	gitpodUrl, err := url.Parse(wsInfo.GitpodHost)
	if err != nil {
		return "", err
	}
	debugWorkspace := wsInfo.DebugWorkspaceType != supervisor.DebugWorkspaceType_noDebug
	link := url.URL{
		Scheme:   "jetbrains-gateway",
		Host:     "connect",
		Fragment: fmt.Sprintf("gitpodHost=%s&workspaceId=%s&backendPort=%s&debugWorkspace=%t", gitpodUrl.Hostname(), wsInfo.WorkspaceId, backendPort, debugWorkspace),
	}
	return link.String(), nil
}

func resolveJsonLink(backendPort string) (string, error) {
	var (
		hostStatusUrl = "http://localhost:" + backendPort + "/codeWithMe/unattendedHostStatus?token=gitpod"
		client        = http.Client{Timeout: 1 * time.Second}
	)
	resp, err := client.Get(hostStatusUrl)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	bodyBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", xerrors.Errorf("failed to resolve project status: %s (%d)", bodyBytes, resp.StatusCode)
	}
	jsonResp := &Response{}
	err = json.Unmarshal(bodyBytes, &jsonResp)
	if err != nil {
		return "", err
	}
	if len(jsonResp.Projects) != 1 {
		return "", xerrors.Errorf("project is not found")
	}
	return jsonResp.Projects[0].JoinLink, nil
}

func resolveJsonLink2(backendPort string) (*JoinLinkResponse, error) {
	var (
		hostStatusUrl = "http://localhost:" + backendPort + "/codeWithMe/unattendedHostStatus?token=gitpod"
		client        = http.Client{Timeout: 1 * time.Second}
	)
	resp, err := client.Get(hostStatusUrl)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	bodyBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, xerrors.Errorf("failed to resolve project status: %s (%d)", bodyBytes, resp.StatusCode)
	}
	jsonResp := &Response{}
	err = json.Unmarshal(bodyBytes, &jsonResp)
	if err != nil {
		return nil, err
	}
	if len(jsonResp.Projects) > 0 {
		return &JoinLinkResponse{AppPid: jsonResp.AppPid, JoinLink: jsonResp.Projects[0].JoinLink}, nil

	}
	if len(jsonResp.JoinLink) > 0 {
		return &JoinLinkResponse{AppPid: jsonResp.AppPid, JoinLink: jsonResp.JoinLink}, nil
	}
	log.Error("failed to resolve JetBrains JoinLink")
	return nil, xerrors.Errorf("failed to resolve JoinLink")
}

func terminateIDE(backendPort string) error {
	var (
		hostStatusUrl = "http://localhost:" + backendPort + "/codeWithMe/unattendedHostStatus?token=gitpod&exit=true"
		client        = http.Client{Timeout: 10 * time.Second}
	)
	resp, err := client.Get(hostStatusUrl)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	bodyBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return xerrors.Errorf("failed to resolve terminate IDE: %s (%d)", bodyBytes, resp.StatusCode)
	}
	return nil
}

func resolveWorkspaceInfo(ctx context.Context) (*supervisor.WorkspaceInfoResponse, error) {
	resolve := func(ctx context.Context) (wsInfo *supervisor.WorkspaceInfoResponse, err error) {
		supervisorConn, err := grpc.Dial(util.GetSupervisorAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			err = errors.New("dial supervisor failed: " + err.Error())
			return
		}
		defer supervisorConn.Close()
		if wsInfo, err = supervisor.NewInfoServiceClient(supervisorConn).WorkspaceInfo(ctx, &supervisor.WorkspaceInfoRequest{}); err != nil {
			err = errors.New("get workspace info failed: " + err.Error())
			return
		}
		return
	}
	// try resolve workspace info 10 times
	for attempt := 0; attempt < 10; attempt++ {
		if wsInfo, err := resolve(ctx); err != nil {
			log.WithError(err).Error("resolve workspace info failed")
			time.Sleep(1 * time.Second)
		} else {
			return wsInfo, err
		}
	}
	return nil, errors.New("failed with attempt 10 times")
}

func launch(launchCtx *LaunchContext) {
	projectDir := launchCtx.wsInfo.GetCheckoutLocation()
	gitpodConfig, err := parseGitpodConfig(projectDir)
	if err != nil {
		log.WithError(err).Error("failed to parse .gitpod.yml")
	}

	// configure vmoptions
	idePrefix := launchCtx.alias
	if launchCtx.alias == "intellij" {
		idePrefix = "idea"
	}
	// [idea64|goland64|pycharm64|phpstorm64].vmoptions
	launchCtx.vmOptionsFile = fmt.Sprintf(launchCtx.backendDir+"/bin/%s64.vmoptions", idePrefix)
	err = configureVMOptions(gitpodConfig, launchCtx.alias, launchCtx.vmOptionsFile)
	if err != nil {
		log.WithError(err).Error("failed to configure vmoptions")
	}

	var riderSolutionFile string
	if launchCtx.alias == "rider" {
		riderSolutionFile, err = findRiderSolutionFile(projectDir)
		if err != nil {
			log.WithError(err).Error("failed to find a rider solution file")
		}
	}

	launchCtx.projectDir = projectDir
	launchCtx.configDir = fmt.Sprintf("/workspace/.config/JetBrains%s/RemoteDev-%s", launchCtx.qualifier, launchCtx.info.ProductCode)
	launchCtx.systemDir = fmt.Sprintf("/workspace/.cache/JetBrains%s/RemoteDev-%s", launchCtx.qualifier, launchCtx.info.ProductCode)
	launchCtx.riderSolutionFile = riderSolutionFile
	launchCtx.projectContextDir = resolveProjectContextDir(launchCtx)

	launchCtx.platformPropertiesFile = launchCtx.backendDir + "/bin/idea.properties"
	_, err = configurePlatformProperties(launchCtx.platformPropertiesFile, launchCtx.configDir, launchCtx.systemDir)
	if err != nil {
		log.WithError(err).Error("failed to update platform properties file")
	}

	_, err = syncInitialContent(launchCtx, Options)
	if err != nil {
		log.WithError(err).Error("failed to sync initial options")
	}

	launchCtx.env = resolveLaunchContextEnv()

	_, err = syncInitialContent(launchCtx, Plugins)
	if err != nil {
		log.WithError(err).Error("failed to sync initial plugins")
	}

	// install project plugins
	err = installPlugins(gitpodConfig, launchCtx)
	installPluginsCost := time.Now().Local().Sub(launchCtx.startTime).Milliseconds()
	if err != nil {
		log.WithError(err).WithField("cost", installPluginsCost).Error("installing repo plugins: done")
	} else {
		log.WithField("cost", installPluginsCost).Info("installing repo plugins: done")
	}

	// install gitpod plugin
	err = linkRemotePlugin(launchCtx)
	if err != nil {
		log.WithError(err).Error("failed to install gitpod-remote plugin")
	}

	// run backend
	run(launchCtx)
}

func run(launchCtx *LaunchContext) {
	var args []string
	if launchCtx.warmup {
		args = append(args, "warmup")
	} else {
		args = append(args, "run")
	}
	args = append(args, launchCtx.projectContextDir)

	cmd := remoteDevServerCmd(args, launchCtx)
	cmd.Env = append(cmd.Env, "JETBRAINS_GITPOD_BACKEND_KIND="+launchCtx.alias)
	workspaceUrl, err := url.Parse(launchCtx.wsInfo.WorkspaceUrl)
	if err == nil {
		cmd.Env = append(cmd.Env, "JETBRAINS_GITPOD_WORKSPACE_HOST="+workspaceUrl.Hostname())
	}
	// Enable host status endpoint
	cmd.Env = append(cmd.Env, "CWM_HOST_STATUS_OVER_HTTP_TOKEN=gitpod")

	if err := cmd.Start(); err != nil {
		log.WithError(err).Error("failed to start")
	}

	// Nicely handle SIGTERM sinal
	go handleSignal()

	if err := cmd.Wait(); err != nil {
		log.WithError(err).Error("failed to wait")
	}
	log.Info("IDE stopped, exiting")
	os.Exit(cmd.ProcessState.ExitCode())
}

// resolveUserEnvs emulats the interactive login shell to ensure that all user defined shell scripts are loaded
func resolveUserEnvs() (userEnvs []string, err error) {
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}
	mark, err := uuid.NewRandom()
	if err != nil {
		return
	}

	self, err := os.Executable()
	if err != nil {
		return
	}
	envCmd := exec.Command(shell, []string{"-i", "-l", "-c", strings.Join([]string{self, "env", mark.String()}, " ")}...)
	envCmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	envCmd.Stderr = os.Stderr
	envCmd.WaitDelay = 3 * time.Second
	time.AfterFunc(8*time.Second, func() {
		_ = syscall.Kill(-envCmd.Process.Pid, syscall.SIGKILL)
	})

	output, err := envCmd.Output()
	if errors.Is(err, exec.ErrWaitDelay) {
		// For some reason the command doesn't close it's I/O pipes but it already run successfully
		// so just ignore this error
		log.Warn("WaitDelay expired before envCmd I/O completed")
	} else if err != nil {
		return
	}

	markByte := []byte(mark.String())
	start := bytes.Index(output, markByte)
	if start == -1 {
		err = fmt.Errorf("no %s in output", mark.String())
		return
	}
	start = start + len(markByte)
	if start > len(output) {
		err = fmt.Errorf("no %s in output", mark.String())
		return
	}
	end := bytes.LastIndex(output, markByte)
	if end == -1 {
		err = fmt.Errorf("no %s in output", mark.String())
		return
	}
	err = json.Unmarshal(output[start:end], &userEnvs)
	return
}

func resolveLaunchContextEnv() []string {
	var launchCtxEnv []string
	userEnvs, err := resolveUserEnvs()
	if err == nil {
		launchCtxEnv = append(launchCtxEnv, userEnvs...)
	} else {
		log.WithError(err).Error("failed to resolve user env vars")
		launchCtxEnv = os.Environ()
	}

	// instead put them into /ide-desktop/${alias}${qualifier}/backend/bin/idea64.vmoptions
	// otherwise JB will complain to a user on each startup
	// by default remote dev already set -Xmx2048m, see /ide-desktop/${alias}${qualifier}/backend/plugins/remote-dev-server/bin/launcher.sh
	launchCtxEnv = append(launchCtxEnv, "INTELLIJ_ORIGINAL_ENV_JAVA_TOOL_OPTIONS="+os.Getenv("JAVA_TOOL_OPTIONS"))
	launchCtxEnv = append(launchCtxEnv, "JAVA_TOOL_OPTIONS=")

	// Force it to be disabled as we update platform properties file already
	// TODO: Some ides have it enabled by default still, check pycharm and remove next release
	launchCtxEnv = append(launchCtxEnv, "REMOTE_DEV_LEGACY_PER_PROJECT_CONFIGS=0")

	log.WithField("env", strings.Join(launchCtxEnv, "\n")).Info("resolved launch env")

	return launchCtxEnv
}

func remoteDevServerCmd(args []string, launchCtx *LaunchContext) *exec.Cmd {
	cmd := exec.Command(launchCtx.backendDir+"/bin/remote-dev-server.sh", args...)
	cmd.Env = launchCtx.env
	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout
	return cmd
}

func handleSignal() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	<-sigChan
	log.WithField("port", defaultBackendPort).Info("receive SIGTERM signal, terminating IDE")
	if err := terminateIDE(defaultBackendPort); err != nil {
		log.WithError(err).Error("failed to terminate IDE")
	}
	log.Info("asked IDE to terminate")
}

func configurePlatformProperties(platformOptionsPath string, configDir string, systemDir string) (bool, error) {
	buffer, err := os.ReadFile(platformOptionsPath)
	if err != nil {
		return false, err
	}

	content := string(buffer)

	updated, content := updatePlatformProperties(content, configDir, systemDir)

	if updated {
		return true, os.WriteFile(platformOptionsPath, []byte(content), 0)
	}

	return false, nil
}

func updatePlatformProperties(content string, configDir string, systemDir string) (bool, string) {
	lines := strings.Split(content, "\n")
	configMap := make(map[string]bool)
	for _, v := range lines {
		v = strings.TrimSpace(v)
		if v != "" && !strings.HasPrefix(v, "#") {
			key, _, found := strings.Cut(v, "=")
			if found {
				configMap[key] = true
			}
		}
	}

	updated := false

	if _, found := configMap["idea.config.path"]; !found {
		updated = true
		content = strings.Join([]string{
			content,
			fmt.Sprintf("idea.config.path=%s", configDir),
			fmt.Sprintf("idea.plugins.path=%s", configDir+"/plugins"),
			fmt.Sprintf("idea.system.path=%s", systemDir),
			fmt.Sprintf("idea.log.path=%s", systemDir+"/log"),
		}, "\n")
	}

	return updated, content
}

func configureVMOptions(config *gitpod.GitpodConfig, alias string, vmOptionsPath string) error {
	options, err := readVMOptions(vmOptionsPath)
	if err != nil {
		return err
	}
	newOptions := updateVMOptions(config, alias, options)
	return writeVMOptions(vmOptionsPath, newOptions)
}

func readVMOptions(vmOptionsPath string) ([]string, error) {
	content, err := os.ReadFile(vmOptionsPath)
	if err != nil {
		return nil, err
	}
	return strings.Fields(string(content)), nil
}

func writeVMOptions(vmOptionsPath string, vmoptions []string) error {
	// vmoptions file should end with a newline
	content := strings.Join(vmoptions, "\n") + "\n"
	return os.WriteFile(vmOptionsPath, []byte(content), 0)
}

// deduplicateVMOption append new VMOptions onto old VMOptions and remove any duplicated leftmost options
func deduplicateVMOption(oldLines []string, newLines []string, predicate func(l, r string) bool) []string {
	var result []string
	var merged = append(oldLines, newLines...)
	for i, left := range merged {
		for _, right := range merged[i+1:] {
			if predicate(left, right) {
				left = ""
				break
			}
		}
		if left != "" {
			result = append(result, left)
		}
	}
	return result
}

func updateVMOptions(
	config *gitpod.GitpodConfig,
	alias string,
	// original vmoptions (inherited from $JETBRAINS_IDE_HOME/bin/idea64.vmoptions)
	ideaVMOptionsLines []string) []string {
	// inspired by how intellij platform merge the VMOptions
	// https://github.com/JetBrains/intellij-community/blob/master/platform/platform-impl/src/com/intellij/openapi/application/ConfigImportHelper.java#L1115
	filterFunc := func(l, r string) bool {
		isEqual := l == r
		isXmx := strings.HasPrefix(l, "-Xmx") && strings.HasPrefix(r, "-Xmx")
		isXms := strings.HasPrefix(l, "-Xms") && strings.HasPrefix(r, "-Xms")
		isXss := strings.HasPrefix(l, "-Xss") && strings.HasPrefix(r, "-Xss")
		isXXOptions := strings.HasPrefix(l, "-XX:") && strings.HasPrefix(r, "-XX:") &&
			strings.Split(l, "=")[0] == strings.Split(r, "=")[0]
		return isEqual || isXmx || isXms || isXss || isXXOptions
	}
	// Gitpod's default customization
	var gitpodVMOptions []string
	gitpodVMOptions = append(gitpodVMOptions, "-Dgtw.disable.exit.dialog=true")
	// temporary disable auto-attach of the async-profiler to prevent JVM crash
	// see https://youtrack.jetbrains.com/issue/IDEA-326201/SIGSEGV-on-startup-2023.2-IDE-backend-on-gitpod.io?s=SIGSEGV-on-startup-2023.2-IDE-backend-on-gitpod.io
	gitpodVMOptions = append(gitpodVMOptions, "-Dfreeze.reporter.profiling=false")
	if alias == "intellij" {
		gitpodVMOptions = append(gitpodVMOptions, "-Djdk.configure.existing=true")
	}
	// container relevant options
	gitpodVMOptions = append(gitpodVMOptions, "-XX:+UseContainerSupport")
	cpuCount := os.Getenv("GITPOD_CPU_COUNT")
	parsedCPUCount, err := strconv.Atoi(cpuCount)
	// if CPU count is set and is parseable as a positive number
	if err == nil && parsedCPUCount > 0 && parsedCPUCount <= 16 {
		gitpodVMOptions = append(gitpodVMOptions, "-XX:ActiveProcessorCount="+cpuCount)
	}
	vmoptions := deduplicateVMOption(ideaVMOptionsLines, gitpodVMOptions, filterFunc)

	// user-defined vmoptions (EnvVar)
	userVMOptionsVar := os.Getenv(strings.ToUpper(alias) + "_VMOPTIONS")
	userVMOptions := strings.Fields(userVMOptionsVar)
	if len(userVMOptions) > 0 {
		vmoptions = deduplicateVMOption(vmoptions, userVMOptions, filterFunc)
	}

	// project-defined vmoptions (.gitpod.yml)
	if config != nil {
		productConfig := getProductConfig(config, alias)
		if productConfig != nil {
			projectVMOptions := strings.Fields(productConfig.Vmoptions)
			if len(projectVMOptions) > 0 {
				vmoptions = deduplicateVMOption(vmoptions, projectVMOptions, filterFunc)
			}
		}
	}

	return vmoptions
}

/*
*

	{
	  "buildNumber" : "221.4994.44",
	  "customProperties" : [ ],
	  "dataDirectoryName" : "IntelliJIdea2022.1",
	  "launch" : [ {
	    "javaExecutablePath" : "jbr/bin/java",
	    "launcherPath" : "bin/idea.sh",
	    "os" : "Linux",
	    "startupWmClass" : "jetbrains-idea",
	    "vmOptionsFilePath" : "bin/idea64.vmoptions"
	  } ],
	  "name" : "IntelliJ IDEA",
	  "productCode" : "IU",
	  "svgIconPath" : "bin/idea.svg",
	  "version" : "2022.1",
	  "versionSuffix" : "EAP"
	}
*/
type ProductInfo struct {
	Version     string `json:"version"`
	ProductCode string `json:"productCode"`
}

func resolveProductInfo(backendDir string) (*ProductInfo, error) {
	f, err := os.Open(backendDir + "/product-info.json")
	if err != nil {
		return nil, err
	}
	defer f.Close()
	content, err := ioutil.ReadAll(f)
	if err != nil {
		return nil, err
	}

	var info ProductInfo
	err = json.Unmarshal(content, &info)
	return &info, err
}

type SyncTarget string

const (
	Options SyncTarget = "options"
	Plugins SyncTarget = "plugins"
)

func syncInitialContent(launchCtx *LaunchContext, target SyncTarget) (bool, error) {
	destDir, err, alreadySynced := ensureInitialSyncDest(launchCtx, target)
	if alreadySynced {
		log.Infof("initial %s is already synced, skipping", target)
		return alreadySynced, nil
	}
	if err != nil {
		return alreadySynced, err
	}

	srcDirs, err := collectSyncSources(launchCtx, target)
	if err != nil {
		return alreadySynced, err
	}
	if len(srcDirs) == 0 {
		// nothing to sync
		return alreadySynced, nil
	}

	for _, srcDir := range srcDirs {
		if target == Plugins {
			files, err := ioutil.ReadDir(srcDir)
			if err != nil {
				return alreadySynced, err
			}

			for _, file := range files {
				err := syncPlugin(file, srcDir, destDir)
				if err != nil {
					log.WithError(err).WithField("file", file.Name()).WithField("srcDir", srcDir).WithField("destDir", destDir).Error("failed to sync plugin")
				}
			}
		} else {
			cp := exec.Command("cp", "-rf", srcDir+"/.", destDir)
			err = cp.Run()
			if err != nil {
				return alreadySynced, err
			}
		}
	}
	return alreadySynced, nil
}

func syncPlugin(file fs.FileInfo, srcDir, destDir string) error {
	if file.IsDir() {
		_, err := os.Stat(filepath.Join(destDir, file.Name()))
		if !os.IsNotExist(err) {
			log.WithField("plugin", file.Name()).Info("plugin is already synced, skipping")
			return nil
		}
		return exec.Command("cp", "-rf", filepath.Join(srcDir, file.Name()), destDir).Run()
	}
	if filepath.Ext(file.Name()) != ".zip" {
		return nil
	}
	archiveFile := filepath.Join(srcDir, file.Name())
	rootDir, err := getRootDirFromArchive(archiveFile)
	if err != nil {
		return err
	}
	_, err = os.Stat(filepath.Join(destDir, rootDir))
	if !os.IsNotExist(err) {
		log.WithField("plugin", rootDir).Info("plugin is already synced, skipping")
		return nil
	}
	return unzipArchive(archiveFile, destDir)
}

func ensureInitialSyncDest(launchCtx *LaunchContext, target SyncTarget) (string, error, bool) {
	targetDestDir := launchCtx.configDir
	if target == Plugins {
		targetDestDir = launchCtx.backendDir
	}
	destDir := fmt.Sprintf("%s/%s", targetDestDir, target)
	if target == Options {
		_, err := os.Stat(destDir)
		if !os.IsNotExist(err) {
			return "", nil, true
		}
		err = os.MkdirAll(destDir, os.ModePerm)
		if err != nil {
			return "", err, false
		}
	}
	return destDir, nil, false
}

func collectSyncSources(launchCtx *LaunchContext, target SyncTarget) ([]string, error) {
	userHomeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	var srcDirs []string
	for _, srcDir := range []string{
		fmt.Sprintf("%s/.gitpod/jetbrains/%s", userHomeDir, target),
		fmt.Sprintf("%s/.gitpod/jetbrains/%s/%s", userHomeDir, launchCtx.alias, target),
		fmt.Sprintf("%s/.gitpod/jetbrains/%s", launchCtx.projectDir, target),
		fmt.Sprintf("%s/.gitpod/jetbrains/%s/%s", launchCtx.projectDir, launchCtx.alias, target),
	} {
		srcStat, err := os.Stat(srcDir)
		if os.IsNotExist(err) {
			// nothing to sync
			continue
		}
		if err != nil {
			return nil, err
		}
		if !srcStat.IsDir() {
			return nil, fmt.Errorf("%s is not a directory", srcDir)
		}
		srcDirs = append(srcDirs, srcDir)
	}
	return srcDirs, nil
}

func getRootDirFromArchive(zipPath string) (string, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return "", err
	}
	defer r.Close()

	if len(r.File) == 0 {
		return "", fmt.Errorf("empty archive")
	}

	// Assuming the first file in the zip is the root directory or a file in the root directory
	return strings.SplitN(r.File[0].Name, "/", 2)[0], nil
}

func unzipArchive(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		rc, err := f.Open()
		if err != nil {
			return err
		}
		defer rc.Close()

		fpath := filepath.Join(dest, f.Name)
		if f.FileInfo().IsDir() {
			err := os.MkdirAll(fpath, os.ModePerm)
			if err != nil {
				return err
			}
		} else {
			fdir := filepath.Dir(fpath)
			err := os.MkdirAll(fdir, os.ModePerm)
			if err != nil {
				return err
			}

			outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
			if err != nil {
				return err
			}
			defer outFile.Close()

			_, err = io.Copy(outFile, rc)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func installPlugins(config *gitpod.GitpodConfig, launchCtx *LaunchContext) error {
	plugins, err := getPlugins(config, launchCtx.alias)
	if err != nil {
		return err
	}
	if len(plugins) <= 0 {
		return nil
	}

	var args []string
	args = append(args, "installPlugins")
	args = append(args, launchCtx.projectContextDir)
	args = append(args, plugins...)
	cmd := remoteDevServerCmd(args, launchCtx)
	installErr := cmd.Run()

	// delete alien_plugins.txt to suppress 3rd-party plugins consent on startup to workaround backend startup freeze
	err = os.Remove(launchCtx.configDir + "/alien_plugins.txt")
	if err != nil && !os.IsNotExist(err) && !strings.Contains(err.Error(), "no such file or directory") {
		log.WithError(err).Error("failed to suppress 3rd-party plugins consent")
	}

	if installErr != nil {
		return errors.New("failed to install repo plugins: " + installErr.Error())
	}
	return nil
}

func parseGitpodConfig(repoRoot string) (*gitpod.GitpodConfig, error) {
	if repoRoot == "" {
		return nil, errors.New("repoRoot is empty")
	}
	data, err := os.ReadFile(filepath.Join(repoRoot, ".gitpod.yml"))
	if err != nil {
		// .gitpod.yml not exist is ok
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, errors.New("read .gitpod.yml file failed: " + err.Error())
	}
	var config *gitpod.GitpodConfig
	if err = yaml.Unmarshal(data, &config); err != nil {
		return nil, errors.New("unmarshal .gitpod.yml file failed" + err.Error())
	}
	return config, nil
}

func getPlugins(config *gitpod.GitpodConfig, alias string) ([]string, error) {
	var plugins []string
	if config == nil || config.Jetbrains == nil {
		return nil, nil
	}
	if config.Jetbrains.Plugins != nil {
		plugins = append(plugins, config.Jetbrains.Plugins...)
	}
	productConfig := getProductConfig(config, alias)
	if productConfig != nil && productConfig.Plugins != nil {
		plugins = append(plugins, productConfig.Plugins...)
	}
	return plugins, nil
}

func getProductConfig(config *gitpod.GitpodConfig, alias string) *gitpod.JetbrainsProduct {
	defer func() {
		if err := recover(); err != nil {
			log.WithField("error", err).WithField("alias", alias).Error("failed to extract JB product config")
		}
	}()
	v := reflect.ValueOf(*config.Jetbrains).FieldByNameFunc(func(s string) bool {
		return strings.ToLower(s) == alias
	}).Interface()
	productConfig, ok := v.(*gitpod.JetbrainsProduct)
	if !ok {
		return nil
	}
	return productConfig
}

func linkRemotePlugin(launchCtx *LaunchContext) error {
	remotePluginsFolder := launchCtx.configDir + "/plugins"
	if launchCtx.info.Version == "2022.3.3" {
		remotePluginsFolder = launchCtx.backendDir + "/plugins"
	}
	remotePluginDir := remotePluginsFolder + "/gitpod-remote"
	_, err := os.Stat(remotePluginDir)
	if err == nil || !errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err := os.MkdirAll(remotePluginsFolder, 0755); err != nil {
		return err
	}

	// added for backwards compatibility, can be removed in the future
	sourceDir := "/ide-desktop-plugins/gitpod-remote-" + os.Getenv("JETBRAINS_BACKEND_QUALIFIER")
	_, err = os.Stat(sourceDir)
	if err == nil {
		return os.Symlink(sourceDir, remotePluginDir)
	}

	return os.Symlink("/ide-desktop-plugins/gitpod-remote", remotePluginDir)
}

// TODO(andreafalzetti): remove dir scanning once this is implemented https://youtrack.jetbrains.com/issue/GTW-2402/Rider-Open-Project-dialog-not-displaying-in-remote-dev
func findRiderSolutionFile(root string) (string, error) {
	slnRegEx := regexp.MustCompile(`^.+\.sln$`)
	projRegEx := regexp.MustCompile(`^.+\.csproj$`)

	var slnFiles []string
	var csprojFiles []string

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		} else if slnRegEx.MatchString(info.Name()) {
			slnFiles = append(slnFiles, path)
		} else if projRegEx.MatchString(info.Name()) {
			csprojFiles = append(csprojFiles, path)
		}
		return nil
	})

	if err != nil {
		return "", err
	}

	if len(slnFiles) > 0 {
		return slnFiles[0], nil
	} else if len(csprojFiles) > 0 {
		return csprojFiles[0], nil
	}

	return root, nil
}

func resolveProjectContextDir(launchCtx *LaunchContext) string {
	if launchCtx.alias == "rider" {
		return launchCtx.riderSolutionFile
	}

	return launchCtx.projectDir
}

func configureToolboxCliProperties(backendDir string) error {
	userHomeDir, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	toolboxCliPropertiesDir := fmt.Sprintf("%s/.local/share/JetBrains/Toolbox", userHomeDir)
	_, err = os.Stat(toolboxCliPropertiesDir)
	if !os.IsNotExist(err) {
		return err
	}
	err = os.MkdirAll(toolboxCliPropertiesDir, os.ModePerm)
	if err != nil {
		return err
	}

	toolboxCliPropertiesFilePath := fmt.Sprintf("%s/environment.json", toolboxCliPropertiesDir)

	content := fmt.Sprintf(`{
    "tools": {
        "allowInstallation": false,
        "allowUpdate": false,
        "allowUninstallation": false,
        "location": [
            {
                "path": "%s"
            }
        ]
    }
}`, backendDir)

	return os.WriteFile(toolboxCliPropertiesFilePath, []byte(content), 0o644)
}
