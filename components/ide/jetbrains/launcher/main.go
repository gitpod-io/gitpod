// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
)

const defaultBackendPort = "63342"

var (
	// ServiceName is the name we use for tracing/logging.
	ServiceName = "jetbrains-launcher"
	// Version of this service - set during build.
	Version = ""
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

	vmOptionsFile     string
	projectDir        string
	configDir         string
	systemDir         string
	projectConfigDir  string
	projectContextDir string
	riderSolutionFile string

	env []string
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

	log.Init(ServiceName, Version, true, false)
	log.Info(ServiceName + ": " + Version)
	startTime := time.Now()

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

		qualifier:      qualifier,
		productDir:     productDir,
		backendDir:     backendDir,
		info:           info,
		backendVersion: backendVersion,
		wsInfo:         wsInfo,
	}

	if launchCtx.warmup {
		launch(launchCtx)
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
	Projects []Projects `json:"projects"`
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
	launchCtx.configDir = fmt.Sprintf("/workspace/.config/JetBrains%s", launchCtx.qualifier)
	launchCtx.systemDir = fmt.Sprintf("/workspace/.cache/JetBrains%s", launchCtx.qualifier)
	launchCtx.riderSolutionFile = riderSolutionFile
	launchCtx.projectContextDir = resolveProjectContextDir(launchCtx)
	launchCtx.projectConfigDir = fmt.Sprintf("%s/RemoteDev-%s/%s", launchCtx.configDir, launchCtx.info.ProductCode, strings.ReplaceAll(launchCtx.projectContextDir, "/", "_"))
	launchCtx.env = resolveLaunchContextEnv(launchCtx.configDir, launchCtx.systemDir)

	// sync initial options
	err = syncOptions(launchCtx)
	if err != nil {
		log.WithError(err).Error("failed to sync initial options")
	}

	// install project plugins
	version_2022_1, _ := version.NewVersion("2022.1")
	if version_2022_1.LessThanOrEqual(launchCtx.backendVersion) {
		err = installPlugins(gitpodConfig, launchCtx)
		installPluginsCost := time.Now().Local().Sub(launchCtx.startTime).Milliseconds()
		if err != nil {
			log.WithError(err).WithField("cost", installPluginsCost).Error("installing repo plugins: done")
		} else {
			log.WithField("cost", installPluginsCost).Info("installing repo plugins: done")
		}
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

func resolveLaunchContextEnv(configDir string, systemDir string) []string {
	var launchCtxEnv []string
	userEnvs, err := resolveUserEnvs()
	if err == nil {
		launchCtxEnv = append(launchCtxEnv, userEnvs...)
	} else {
		log.WithError(err).Error("failed to resolve user env vars")
		launchCtxEnv = os.Environ()
	}

	// Set default config and system directories under /workspace to preserve between restarts
	launchCtxEnv = append(launchCtxEnv,
		// Set default config and system directories under /workspace to preserve between restarts
		fmt.Sprintf("IJ_HOST_CONFIG_BASE_DIR=%s", configDir),
		fmt.Sprintf("IJ_HOST_SYSTEM_BASE_DIR=%s", systemDir),
	)

	// instead put them into /ide-desktop/${alias}${qualifier}/backend/bin/idea64.vmoptions
	// otherwise JB will complain to a user on each startup
	// by default remote dev already set -Xmx2048m, see /ide-desktop/${alias}${qualifier}/backend/plugins/remote-dev-server/bin/launcher.sh
	launchCtxEnv = append(launchCtxEnv, "JAVA_TOOL_OPTIONS=")

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

func configureVMOptions(config *gitpod.GitpodConfig, alias string, vmOptionsPath string) error {
	options, err := readVMOptions(vmOptionsPath)
	if err != nil {
		return err
	}
	newOptions := updateVMOptions(config, alias, options)
	return writeVMOptions(vmOptionsPath, newOptions)
}

func readVMOptions(vmOptionsPath string) ([]string, error) {
	content, err := ioutil.ReadFile(vmOptionsPath)
	if err != nil {
		return nil, err
	}
	return strings.Fields(string(content)), nil
}

func writeVMOptions(vmOptionsPath string, vmoptions []string) error {
	// vmoptions file should end with a newline
	content := strings.Join(vmoptions, "\n") + "\n"
	return ioutil.WriteFile(vmOptionsPath, []byte(content), 0)
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

func syncOptions(launchCtx *LaunchContext) error {
	userHomeDir, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	var srcDirs []string
	for _, srcDir := range []string{
		fmt.Sprintf("%s/.gitpod/jetbrains/options", userHomeDir),
		fmt.Sprintf("%s/.gitpod/jetbrains/%s/options", userHomeDir, launchCtx.alias),
		fmt.Sprintf("%s/.gitpod/jetbrains/options", launchCtx.projectDir),
		fmt.Sprintf("%s/.gitpod/jetbrains/%s/options", launchCtx.projectDir, launchCtx.alias),
	} {
		srcStat, err := os.Stat(srcDir)
		if os.IsNotExist(err) {
			// nothing to sync
			continue
		}
		if err != nil {
			return err
		}
		if !srcStat.IsDir() {
			return fmt.Errorf("%s is not a directory", srcDir)
		}
		srcDirs = append(srcDirs, srcDir)
	}
	if len(srcDirs) == 0 {
		// nothing to sync
		return nil
	}

	destDir := fmt.Sprintf("%s/options", launchCtx.projectConfigDir)
	_, err = os.Stat(destDir)
	if !os.IsNotExist(err) {
		// already synced skipping, i.e. restart of jb backend
		return nil
	}
	err = os.MkdirAll(destDir, os.ModePerm)
	if err != nil {
		return err
	}

	for _, srcDir := range srcDirs {
		cp := exec.Command("cp", "-rf", srcDir+"/.", destDir)
		err = cp.Run()
		if err != nil {
			return err
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
	err = os.Remove(launchCtx.projectConfigDir + "/alien_plugins.txt")
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
	remotePluginDir := launchCtx.backendDir + "/plugins/gitpod-remote"
	_, err := os.Stat(remotePluginDir)
	if err == nil || !errors.Is(err, os.ErrNotExist) {
		return nil
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
