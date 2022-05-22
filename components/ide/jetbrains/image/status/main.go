// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"syscall"
	"time"

	"github.com/hashicorp/go-version"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	yaml "gopkg.in/yaml.v2"

	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
)

const defaultBackendPort = "63342"

var (
	// ServiceName is the name we use for tracing/logging.
	ServiceName = "jetbrains-startup"
	// Version of this service - set during build.
	Version = ""
)

const BackendPath = "/ide-desktop/backend"
const ProductInfoPath = BackendPath + "/product-info.json"

// JB startup entrypoint
func main() {
	log.Init(ServiceName, Version, true, false)
	startTime := time.Now()

	if len(os.Args) < 3 {
		log.Fatalf("Usage: %s <port> <kind> [<link label>]\n", os.Args[0])
	}
	port := os.Args[1]
	alias := os.Args[2]
	label := "Open JetBrains IDE"
	if len(os.Args) > 3 {
		label = os.Args[3]
	}

	backendVersion, err := resolveBackendVersion()
	if err != nil {
		log.WithError(err).Error("failed to resolve backend version")
		return
	}

	// wait until content ready
	contentStatus, wsInfo, err := resolveWorkspaceInfo(context.Background())
	if err != nil || wsInfo == nil || contentStatus == nil || !contentStatus.Available {
		log.WithError(err).WithField("wsInfo", wsInfo).WithField("cstate", contentStatus).Error("resolve workspace info failed")
		return
	}
	log.WithField("cost", time.Now().Local().Sub(startTime).Milliseconds()).Info("content available")

	version_2022_1, _ := version.NewVersion("2022.1")
	if version_2022_1.LessThanOrEqual(backendVersion) {
		err = installPlugins(wsInfo, alias)
		installPluginsCost := time.Now().Local().Sub(startTime).Milliseconds()
		if err != nil {
			log.WithError(err).WithField("cost", installPluginsCost).Error("installing repo plugins: done")
		} else {
			log.WithField("cost", installPluginsCost).Info("installing repo plugins: done")
		}
	}

	err = configureVMOptions(alias)
	if err != nil {
		log.WithError(err).Error("failed to configure vmoptions")
	}
	go run(wsInfo, alias)

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
		jsonLink, err := resolveGatewayLink(backendPort, wsInfo)
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
		gatewayLink, err := resolveGatewayLink(backendPort, wsInfo)
		if err != nil {
			log.WithError(err).Error("cannot resolve gateway link")
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		response := make(map[string]string)
		response["link"] = gatewayLink
		response["label"] = label
		response["clientID"] = "jetbrains-gateway"
		response["kind"] = alias
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	})

	fmt.Printf("Starting status proxy for desktop IDE at port %s\n", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), nil); err != nil {
		log.Fatal(err)
	}
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
	link := url.URL{
		Scheme:   "jetbrains-gateway",
		Host:     "connect",
		Fragment: fmt.Sprintf("gitpodHost=%s&workspaceId=%s&backendPort=%s", gitpodUrl.Hostname(), wsInfo.WorkspaceId, backendPort),
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

func resolveWorkspaceInfo(ctx context.Context) (*supervisor.ContentStatusResponse, *supervisor.WorkspaceInfoResponse, error) {
	resolve := func(ctx context.Context) (contentStatus *supervisor.ContentStatusResponse, wsInfo *supervisor.WorkspaceInfoResponse, err error) {
		supervisorAddr := os.Getenv("SUPERVISOR_ADDR")
		if supervisorAddr == "" {
			supervisorAddr = "localhost:22999"
		}
		supervisorConn, err := grpc.Dial(supervisorAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
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

func run(wsInfo *supervisor.WorkspaceInfoResponse, alias string) {
	var args []string
	args = append(args, "run")
	args = append(args, wsInfo.GetCheckoutLocation())
	cmd := remoteDevServerCmd(args)
	cmd.Env = append(cmd.Env, "JETBRAINS_GITPOD_BACKEND_KIND="+alias)
	workspaceUrl, err := url.Parse(wsInfo.WorkspaceUrl)
	if err == nil {
		cmd.Env = append(cmd.Env, "JETBRAINS_GITPOD_WORKSPACE_HOST="+workspaceUrl.Hostname())
	}
	// Enable host status endpoint
	cmd.Env = append(cmd.Env, "CWM_HOST_STATUS_OVER_HTTP_TOKEN=gitpod")

	if err := cmd.Start(); err != nil {
		log.WithError(err).Error("failed to start")
	}

	// Nicely handle SIGTERM sinal
	go handleSignal(wsInfo.GetCheckoutLocation())

	if err := cmd.Wait(); err != nil {
		log.WithError(err).Error("failed to wait")
	}
	log.Info("IDE stopped, exiting")
	os.Exit(cmd.ProcessState.ExitCode())
}

func remoteDevServerCmd(args []string) *exec.Cmd {
	cmd := exec.Command(BackendPath+"/bin/remote-dev-server.sh", args...)
	cmd.Env = os.Environ()

	// Set default config and system directories under /workspace to preserve between restarts
	qualifier := os.Getenv("JETBRAINS_BACKEND_QUALIFIER")
	if qualifier == "stable" {
		qualifier = ""
	} else {
		qualifier = "-" + qualifier
	}
	cmd.Env = append(cmd.Env,
		fmt.Sprintf("IJ_HOST_CONFIG_BASE_DIR=/workspace/.config/JetBrains%s", qualifier),
		fmt.Sprintf("IJ_HOST_SYSTEM_BASE_DIR=/workspace/.cache/JetBrains%s", qualifier),
	)

	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout
	return cmd
}

func handleSignal(projectPath string) {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	<-sigChan
	log.WithField("port", defaultBackendPort).Info("receive SIGTERM signal, terminating IDE")
	if err := terminateIDE(defaultBackendPort); err != nil {
		log.WithError(err).Error("failed to terminate IDE")
	}
	log.Info("asked IDE to terminate")
}

func configureVMOptions(alias string) error {
	idePrefix := alias
	if alias == "intellij" {
		idePrefix = "idea"
	}
	// [idea64|goland64|pycharm64|phpstorm64].vmoptions
	path := fmt.Sprintf("/ide-desktop/backend/bin/%s64.vmoptions", idePrefix)
	content, err := ioutil.ReadFile(path)
	if err != nil {
		return err
	}
	newContent := updateVMOptions(alias, string(content))
	return ioutil.WriteFile(path, []byte(newContent), 0)
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

func updateVMOptions(alias string, content string) string {
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
	// original vmoptions (inherited from $JETBRAINS_IDE_HOME/bin/idea64.vmoptions)
	ideaVMOptionsLines := strings.Fields(content)
	// Gitpod's default customization
	gitpodVMOptions := []string{"-Dgtw.disable.exit.dialog=true"}
	vmoptions := deduplicateVMOption(ideaVMOptionsLines, gitpodVMOptions, filterFunc)

	// user-defined vmoptions
	userVMOptionsVar := os.Getenv(strings.ToUpper(alias) + "_VMOPTIONS")
	userVMOptions := strings.Fields(userVMOptionsVar)
	if len(userVMOptions) > 0 {
		vmoptions = deduplicateVMOption(vmoptions, userVMOptions, filterFunc)
	}
	// vmoptions file should end with a newline
	return strings.Join(vmoptions, "\n") + "\n"
}

/**
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
	Version string `json:"version"`
}

func resolveBackendVersion() (*version.Version, error) {
	f, err := os.Open(ProductInfoPath)
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
	if err != nil {
		return nil, err
	}
	return version.NewVersion(info.Version)
}

func installPlugins(wsInfo *supervisor.WorkspaceInfoResponse, alias string) error {
	plugins, err := getPlugins(wsInfo.GetCheckoutLocation(), alias)
	if err != nil {
		return err
	}
	if len(plugins) <= 0 {
		return nil
	}
	r, w, err := os.Pipe()
	if err != nil {
		return err
	}
	defer r.Close()

	outC := make(chan string)
	go func() {
		var buf bytes.Buffer
		_, _ = io.Copy(&buf, r)
		outC <- buf.String()
	}()

	var args []string
	args = append(args, "installPlugins")
	args = append(args, wsInfo.GetCheckoutLocation())
	args = append(args, plugins...)
	cmd := remoteDevServerCmd(args)
	cmd.Stdout = io.MultiWriter(w, os.Stdout)
	installErr := cmd.Run()

	// delete alien_plugins.txt to suppress 3rd-party plugins consent on startup to workaround backend startup freeze
	w.Close()
	out := <-outC
	configR := regexp.MustCompile("IDE config directory: (\\S+)\n")
	matches := configR.FindStringSubmatch(out)
	if len(matches) == 2 {
		configDir := matches[1]
		err := os.Remove(configDir + "/alien_plugins.txt")
		if err != nil {
			log.WithError(err).Error("failed to suppress 3rd-party plugins consent")
		}
	}

	if installErr != nil {
		return errors.New("failed to install repo plugins: " + installErr.Error())
	}
	return nil
}

func getPlugins(repoRoot string, alias string) ([]string, error) {
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

	if config == nil || config.JetBrains == nil {
		return nil, nil
	}
	var plugins []string
	if config.JetBrains.Plugins != nil {
		plugins = append(plugins, config.JetBrains.Plugins...)
	}
	productConfig := getProductConfig(config, alias)
	if productConfig != nil && productConfig.Plugins != nil {
		plugins = append(plugins, productConfig.Plugins...)
	}
	return plugins, nil
}

func getProductConfig(config *gitpod.GitpodConfig, alias string) *gitpod.JetBrainsProduct {
	defer func() {
		if err := recover(); err != nil {
			log.WithField("error", err).WithField("alias", alias).Error("failed to extract JB product config")
		}
	}()
	v := reflect.ValueOf(*config.JetBrains).FieldByNameFunc(func(s string) bool {
		return strings.ToLower(s) == alias
	}).Interface()
	productConfig, ok := v.(*gitpod.JetBrainsProduct)
	if !ok {
		return nil
	}
	return productConfig
}
