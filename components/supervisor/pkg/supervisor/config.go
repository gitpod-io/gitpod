// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"time"

	env "github.com/Netflix/go-env"
	"golang.org/x/xerrors"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

const supervisorConfigFile = "supervisor-config.json"

// Supervisor's configuration is dictated by three different lifecycles/sources:
//   1. supervisor (static):
//                  there's some configuration that lives with supervisor and its "installation",
//                  For example the IDE config location depends on if supervisor is served via registry-facade.
//   2. IDE: Gitpod supports different IDEs, all of which have different configuration needs.
//   3. DesktopIDE: Gitpod supports to connect external IDEs (like desktop IDEs).
//   4. Workspace: which depends on the individual workspace, its content and configuration.

// Config configures supervisor
type Config struct {
	StaticConfig
	IDE        IDEConfig
	DesktopIDE *IDEConfig
	WorkspaceConfig
}

// Validate validates the configuration
func (c Config) Validate() error {
	if err := c.StaticConfig.Validate(); err != nil {
		return xerrors.Errorf("static supervisor config is invalid: %w", err)
	}
	if err := c.IDE.Validate(); err != nil {
		return xerrors.Errorf("IDE config is invalid: %w", err)
	}
	if c.DesktopIDE != nil {
		if err := c.DesktopIDE.Validate(); err != nil {
			return xerrors.Errorf("Desktop IDE config is invalid: %w", err)
		}
	}
	if err := c.WorkspaceConfig.Validate(); err != nil {
		return xerrors.Errorf("Workspace config is invalid: %w", err)
	}

	return nil
}

// LogRateLimit returns the log rate limit for the IDE process in kib/sec.
// If log rate limiting is disbaled, this function returns 0.
func (c Config) IDELogRateLimit(ideConfig *IDEConfig) int {
	if c.WorkspaceLogRateLimit < ideConfig.LogRateLimit {
		return c.WorkspaceLogRateLimit
	}
	return ideConfig.LogRateLimit
}

// StaticConfig is the supervisor-wide configuration
type StaticConfig struct {
	// IDEConfigLocation is a path in the filesystem where to find the IDE configuration
	IDEConfigLocation string `json:"ideConfigLocation"`

	// DesktopIDEConfigLocation is a path in the filesystem where to find the desktop IDE configuration
	DesktopIDEConfigLocation string `json:"desktopIdeConfigLocation"`

	// FrontendLocation is a path in the filesystem where to find supervisor's frontend assets
	FrontendLocation string `json:"frontendLocation"`

	// APIEndpointPort is the port where to serve the API endpoint on
	APIEndpointPort int `json:"apiEndpointPort"`

	// SSHPort is the port we run the SSH server on
	SSHPort int `json:"sshPort"`
}

// Validate validates this configuration
func (c StaticConfig) Validate() error {
	if c.IDEConfigLocation == "" {
		return xerrors.Errorf("ideConfigLocation is required")
	}
	if c.FrontendLocation == "" {
		return xerrors.Errorf("frontendLocation is required")
	}
	if !(0 < c.APIEndpointPort && c.APIEndpointPort <= math.MaxUint16) {
		return xerrors.Errorf("apiEndpointPort must be between 0 and %d", math.MaxUint16)
	}
	if !(0 < c.SSHPort && c.SSHPort <= math.MaxUint16) {
		return xerrors.Errorf("sshPort must be between 0 and %d", math.MaxUint16)
	}

	return nil
}

// ReadinessProbeType determines the IDE readiness probe type
type ReadinessProbeType string

const (
	// ReadinessProcessProbe returns ready once the IDE process has been started
	ReadinessProcessProbe ReadinessProbeType = ""

	// ReadinessHTTPProbe returns ready once a single HTTP request against the IDE was successful
	ReadinessHTTPProbe ReadinessProbeType = "http"
)

// IDEConfig is the IDE specific configuration
type IDEConfig struct {
	// Entrypoint is the command that gets executed by supervisor to start
	// the IDE process. If this command exits, supervisor will start it again.
	// If this command exits right after it was started with a non-zero exit
	// code the workspace is stopped.
	Entrypoint string `json:"entrypoint"`

	// EntrypointArgs
	EntrypointArgs []string `json:"entrypointArgs"`

	// LogRateLimit can be used to limit the log output of the IDE process.
	// Any output that exceeds this limit is silently dropped.
	// Expressed in kb/sec. Can be overriden by the workspace config (smallest value wins).
	LogRateLimit int `json:"logRateLimit"`

	// ReadinessProbe configures the probe used to serve the IDE status
	ReadinessProbe struct {
		// Type determines the type of readiness probe we'll use.
		// Defaults to process.
		Type ReadinessProbeType `json:"type"`

		// HTTPProbe configures the HTTP readiness probe.
		HTTPProbe struct {
			// Schema is either "http" or "https". Defaults to "http".
			Schema string `json:"schema"`

			// Host is the host to make requests to. Default to "localhost".
			Host string `json:"host"`

			// Port is the port to make requests to. Default it the IDE port in the supervisor config.
			Port int `json:"port"`

			// Path is the path to make requests to. Defaults to "/".
			Path string `json:"path"`
		} `json:"http"`
	} `json:"readinessProbe"`
}

// Validate validates this configuration
func (c IDEConfig) Validate() error {
	if c.Entrypoint == "" {
		return xerrors.Errorf("entrypoint is required")
	}
	if stat, err := os.Stat(c.Entrypoint); err != nil {
		return xerrors.Errorf("invalid entrypoint: %w", err)
	} else if stat.IsDir() {
		return xerrors.Errorf("entrypoint is a directory, but should be a file")
	}

	if c.LogRateLimit < 0 {
		return xerrors.Errorf("logRateLimit must be >= 0")
	}

	return nil
}

// WorkspaceConfig is the workspace specific configuration. This config is drawn exclusively
// from environment variables.
type WorkspaceConfig struct {
	// WorkspaceContextURL is an URL for which workspace was created.
	WorkspaceContextURL string `env:"GITPOD_WORKSPACE_CONTEXT_URL"`

	// WorkspaceUrl is an URL for which workspace is accessed.
	WorkspaceUrl string `env:"GITPOD_WORKSPACE_URL"`

	// IDEPort is the port at which the IDE will need to run on. This is not an IDE config
	// because Gitpod determines this port, not the IDE.
	IDEPort int `env:"GITPOD_THEIA_PORT"`

	// IDEAlias is the alias of the IDE to be run. Possible values: "code", "code-latest", "theia"
	IDEAlias string `env:"GITPOD_IDE_ALIAS"`

	// WorkspaceRoot is the location in the filesystem where the workspace content root is located.
	WorkspaceRoot string `env:"THEIA_WORKSPACE_ROOT"`

	// RepoRoot is the location in the filesystem where the Git repository (not workspace content)
	// is located. If there's no Git repo in this workspace, this will be empty.
	RepoRoot string `env:"GITPOD_REPO_ROOT"`

	// PreventMetadataAccess exits supervisor/stops the workspace if we can access Google Cloud
	// compute metadata from within the container.
	PreventMetadataAccess bool `env:"THEIA_PREVENT_METADATA_ACCESS"`

	// LogRateLimit limits the log output of the IDE process.
	// Any output that exceeds this limit is silently dropped.
	// Expressed in kb/sec. Can be overriden by the IDE config (smallest value wins).
	WorkspaceLogRateLimit int `env:"THEIA_RATELIMIT_LOG"`

	// GitUsername makes supervisor configure the global user.name Git setting.
	GitUsername string `env:"GITPOD_GIT_USER_NAME"`
	// GitEmail makes supervisor configure the global user.email Git setting.
	GitEmail string `env:"GITPOD_GIT_USER_EMAIL"`

	// Tokens is a JSON encoded list of WorkspaceGitpodToken
	Tokens string `env:"THEIA_SUPERVISOR_TOKENS"`

	// WorkspaceID is the ID of the workspace
	WorkspaceID string `env:"GITPOD_WORKSPACE_ID"`

	// WorkspaceInstanceID is the instance ID of the workspace
	WorkspaceInstanceID string `env:"GITPOD_INSTANCE_ID"`

	// GitpodHost points to the Gitpod API server we're to talk to
	GitpodHost string `env:"GITPOD_HOST"`

	// GitpodTasks is the task configuration of the workspace
	GitpodTasks string `env:"GITPOD_TASKS"`

	// GitpodHeadless controls whether the workspace is running headless
	GitpodHeadless string `env:"GITPOD_HEADLESS"`

	// DebugEnabled controls whether the supervisor debugging facilities (pprof, grpc tracing) shoudl be enabled
	DebugEnable bool `env:"SUPERVISOR_DEBUG_ENABLE"`

	// WorkspaceContext is a context for this workspace
	WorkspaceContext string `env:"GITPOD_WORKSPACE_CONTEXT"`

	// WorkspaceClusterHost is a host under which this workspace is served, e.g. ws-eu11.gitpod.io
	WorkspaceClusterHost string `env:"GITPOD_WORKSPACE_CLUSTER_HOST"`
}

// WorkspaceGitpodToken is a list of tokens that should be added to supervisor's token service
type WorkspaceGitpodToken struct {
	api.SetTokenRequest
	TokenOTS string `json:"tokenOTS"`
}

// TaskConfig defines gitpod task shape
type TaskConfig struct {
	Name     *string                 `json:"name,omitempty"`
	Before   *string                 `json:"before,omitempty"`
	Init     *string                 `json:"init,omitempty"`
	Prebuild *string                 `json:"prebuild,omitempty"`
	Command  *string                 `json:"command,omitempty"`
	Env      *map[string]interface{} `json:"env,omitempty"`
	OpenIn   *string                 `json:"openIn,omitempty"`
	OpenMode *string                 `json:"openMode,omitempty"`
}

// Validate validates this configuration
func (c WorkspaceConfig) Validate() error {
	if !(0 < c.IDEPort && c.IDEPort <= math.MaxUint16) {
		return xerrors.Errorf("GITPOD_THEIA_PORT must be between 0 and %d", math.MaxUint16)
	}

	if c.WorkspaceRoot == "" {
		return xerrors.Errorf("THEIA_WORKSPACE_ROOT is required")
	}

	if c.WorkspaceLogRateLimit < 0 {
		return xerrors.Errorf("logRateLimit must be >= 0")
	}

	if _, err := c.GetTokens(false); err != nil {
		return err
	}

	if _, _, err := c.GitpodAPIEndpoint(); err != nil {
		return err
	}

	return nil
}

// GetTokens parses tokens from GITPOD_TOKENS and possibly downloads OTS.
func (c WorkspaceConfig) GetTokens(downloadOTS bool) ([]WorkspaceGitpodToken, error) {
	if c.Tokens == "" {
		return nil, nil
	}

	var tks []WorkspaceGitpodToken
	err := json.Unmarshal([]byte(c.Tokens), &tks)
	if err != nil {
		return nil, xerrors.Errorf("cannot parse tokens: %w", err)
	}

	if downloadOTS {
		client := http.Client{
			Timeout: 30 * time.Second,
		}

		for i := range tks {
			if tks[i].TokenOTS == "" {
				continue
			}

			resp, err := client.Get(tks[i].TokenOTS)
			if err != nil {
				return nil, xerrors.Errorf("cannot download token OTS: %w", err)
			}
			if resp.StatusCode != http.StatusOK {
				return nil, xerrors.Errorf("cannot download token OTS: %d (%s)", resp.StatusCode, resp.Status)
			}
			tkn, err := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err != nil {
				return nil, xerrors.Errorf("cannot download token OTS: %w", err)
			}
			tks[i].Token = string(tkn)
		}
	}

	return tks, nil
}

// GitpodAPIEndpoint produces the data required to connect to the Gitpod API
func (c WorkspaceConfig) GitpodAPIEndpoint() (endpoint, host string, err error) {
	gphost, err := url.Parse(c.GitpodHost)
	if err != nil {
		return
	}

	wsScheme := "wss"
	if gphost.Scheme == "http" {
		wsScheme = "ws"
	}
	endpoint = fmt.Sprintf("%s://%s/api/v1", wsScheme, gphost.Host)
	host = gphost.Host
	return
}

// getGitpodTasks returns true if the workspace is headless
func (c WorkspaceConfig) isHeadless() bool {
	return c.GitpodHeadless == "true"
}

// getGitpodTasks parses gitpod tasks
func (c WorkspaceConfig) getGitpodTasks() (tasks *[]TaskConfig, err error) {
	if c.GitpodTasks == "" {
		return
	}
	err = json.Unmarshal([]byte(c.GitpodTasks), &tasks)
	if err != nil {
		return nil, xerrors.Errorf("cannot parse tasks: %w", err)
	}
	return
}

// getCommit returns a commit from which this workspace was created
func (c WorkspaceConfig) getCommit() (commit *gitpod.Commit, err error) {
	if c.WorkspaceContext == "" {
		return
	}
	err = json.Unmarshal([]byte(c.WorkspaceContext), &commit)
	if err != nil {
		return nil, xerrors.Errorf("cannot parse workspace context as a commit: %w", err)
	}
	return
}

// GetConfig loads the supervisor configuration
func GetConfig() (*Config, error) {
	static, err := loadStaticConfigFromFile()
	if err != nil {
		return nil, err
	}

	ide, err := loadIDEConfigFromFile(static.IDEConfigLocation)
	if err != nil {
		return nil, err
	}

	var desktopIde *IDEConfig
	if static.DesktopIDEConfigLocation != "" {
		if _, err := os.Stat(static.DesktopIDEConfigLocation); !os.IsNotExist((err)) {
			desktopIde, err = loadIDEConfigFromFile(static.DesktopIDEConfigLocation)
			if err != nil {
				return nil, err
			}
		}
	}

	workspace, err := loadWorkspaceConfigFromEnv()
	if err != nil {
		return nil, err
	}

	return &Config{
		StaticConfig:    *static,
		IDE:             *ide,
		DesktopIDE:      desktopIde,
		WorkspaceConfig: *workspace,
	}, nil
}

// loadStaticConfigFromFile loads the static supervisor configuration from
// a file named "supervisor-config.json" which is expected right next to
// the supervisor executable.
func loadStaticConfigFromFile() (*StaticConfig, error) {
	loc, err := os.Executable()
	if err != nil {
		return nil, xerrors.Errorf("cannot get executable path: %w", err)
	}

	loc = filepath.Join(filepath.Dir(loc), supervisorConfigFile)
	fc, err := os.ReadFile(loc)
	if err != nil {
		return nil, xerrors.Errorf("cannot read supervisor config file %s: %w", loc, err)
	}

	var res StaticConfig
	err = json.Unmarshal(fc, &res)
	if err != nil {
		return nil, xerrors.Errorf("cannot unmarshal supervisor config file %s: %w", loc, err)
	}

	return &res, nil
}

// loadIDEConfigFromFile loads the IDE configuration from a JSON file.
func loadIDEConfigFromFile(fn string) (*IDEConfig, error) {
	f, err := os.Open(fn)
	if err != nil {
		return nil, xerrors.Errorf("cannot load IDE config %s: %w", fn, err)
	}
	defer f.Close()

	var res IDEConfig
	err = json.NewDecoder(f).Decode(&res)
	if err != nil {
		return nil, xerrors.Errorf("cannot unmarshal IDE config %s: %w", fn, err)
	}

	return &res, nil
}

// loadWorkspaceConfigFromEnv loads the workspace configuration from environment variables.
func loadWorkspaceConfigFromEnv() (*WorkspaceConfig, error) {
	var res WorkspaceConfig
	_, err := env.UnmarshalFromEnviron(&res)
	if err != nil {
		return nil, xerrors.Errorf("cannot load workspace config: %w", err)
	}

	return &res, nil
}
