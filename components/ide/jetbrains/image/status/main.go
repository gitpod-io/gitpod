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
	"path/filepath"
	"regexp"
	"time"

	"github.com/hashicorp/go-version"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
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
const RemoteDevServer = BackendPath + "/bin/remote-dev-server.sh"
const ProductInfoPath = BackendPath + "/product-info.json"

// JB startup entrypoint
func main() {
	log.Init(ServiceName, Version, true, false)
	startTime := time.Now()

	if len(os.Args) < 3 {
		log.Fatalf("Usage: %s <port> <kind> [<link label>]\n", os.Args[0])
	}
	port := os.Args[1]
	kind := os.Args[2]
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
		err = installPlugins(wsInfo)
		installPluginsCost := time.Now().Local().Sub(startTime).Milliseconds()
		if err != nil {
			log.WithError(err).WithField("cost", installPluginsCost).Error("installing repo plugins: done")
		} else {
			log.WithField("cost", installPluginsCost).Info("installing repo plugins: done")
		}
	}

	go run(wsInfo)

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
		response["kind"] = kind
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

func run(wsInfo *supervisor.WorkspaceInfoResponse) {
	var args []string
	args = append(args, "run")
	args = append(args, wsInfo.GetCheckoutLocation())
	cmd := exec.Command(RemoteDevServer, args...)
	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout
	if err := cmd.Run(); err != nil {
		log.WithError(err).Error("failed to run")
	}
	os.Exit(cmd.ProcessState.ExitCode())
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

func installPlugins(wsInfo *supervisor.WorkspaceInfoResponse) error {
	plugins, err := getPlugins(wsInfo.GetCheckoutLocation())
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
	cmd := exec.Command(RemoteDevServer, args...)
	cmd.Stderr = os.Stderr
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

func getPlugins(repoRoot string) (plugins []string, err error) {
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
	if config == nil || config.JetBrains == nil {
		err = errors.New("config.vscode field not exists")
		return
	}
	return config.JetBrains.Plugins, nil
}
