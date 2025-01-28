// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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
	"slices"
	"strings"
	"time"

	env "github.com/Netflix/go-env"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"

	"github.com/iancoleman/orderedmap"
)

const supervisorConfigFile = "supervisor-config.json"

// Supervisor's configuration is dictated by three different lifecycles/sources:
//   1. supervisor (static):
//                  there's some configuration that lives with supervisor and its "installation",
//                  For example the IDE config location depends on if supervisor is served via registry-facade.
//   2. IDE: Gitpod supports different IDEs, all of which have different configuration needs.
//   3. DesktopIDE: Gitpod supports to connect external IDEs (like desktop IDEs).
//   4. Workspace: which depends on the individual workspace, its content and configuration.

// Config configures supervisor.
type Config struct {
	StaticConfig
	IDE         IDEConfig
	DesktopIDEs []*IDEConfig
	WorkspaceConfig
}

// Validate validates the configuration.
func (c Config) Validate() error {
	if err := c.StaticConfig.Validate(); err != nil {
		return xerrors.Errorf("static supervisor config is invalid: %w", err)
	}
	if err := c.IDE.Validate(); err != nil {
		return xerrors.Errorf("IDE config is invalid: %w", err)
	}
	for _, desktopIde := range c.DesktopIDEs {
		if err := desktopIde.Validate(); err != nil {
			return xerrors.Errorf("Desktop IDE (%s): config is invalid: %w", desktopIde.Name, err)
		}
	}
	if err := c.WorkspaceConfig.Validate(); err != nil {
		return xerrors.Errorf("Workspace config is invalid: %w", err)
	}

	return nil
}

// LogRateLimit returns the log rate limit for the IDE process in kib/sec.
// If log rate limiting is disabled, this function returns 0.
func (c Config) IDELogRateLimit(ideConfig *IDEConfig) int {
	if c.WorkspaceLogRateLimit < ideConfig.LogRateLimit {
		return c.WorkspaceLogRateLimit
	}
	return ideConfig.LogRateLimit
}

// StaticConfig is the supervisor-wide configuration.
type StaticConfig struct {
	// IDEConfigLocation is a path in the filesystem where to find the IDE configuration
	IDEConfigLocation string `json:"ideConfigLocation"`

	// DesktopIDERoot is a path in the filesystem where to find desktop IDE configurations
	DesktopIDERoot string `json:"desktopIdeRoot"`

	// FrontendLocation is a path in the filesystem where to find supervisor's frontend assets
	FrontendLocation string `json:"frontendLocation"`

	// APIEndpointPort is the port where to serve the API endpoint on
	APIEndpointPort int `json:"apiEndpointPort"`

	// SSHPort is the port we run the SSH server on
	SSHPort int `json:"sshPort"`
}

// Validate validates this configuration.
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

// ReadinessProbeType determines the IDE readiness probe type.
type ReadinessProbeType string

const (
	// ReadinessProcessProbe returns ready once the IDE process has been started.
	ReadinessProcessProbe ReadinessProbeType = ""

	// ReadinessHTTPProbe returns ready once a single HTTP request against the IDE was successful.
	ReadinessHTTPProbe ReadinessProbeType = "http"
)

// IDEConfig is the IDE specific configuration.
type IDEConfig struct {
	// Name is the unique identifier of the IDE.
	Name string `json:"name"`

	// DisplayName is the human readable name of the IDE.
	DisplayName string `json:"displayName"`

	// Version is the version of the IDE.
	Version string `json:"version"`

	// Entrypoint is the command that gets executed by supervisor to start
	// the IDE process. If this command exits, supervisor will start it again.
	// If this command exits right after it was started with a non-zero exit
	// code the workspace is stopped.
	Entrypoint string `json:"entrypoint"`

	// EntrypointArgs
	EntrypointArgs []string `json:"entrypointArgs"`

	// LogRateLimit can be used to limit the log output of the IDE process.
	// Any output that exceeds this limit is silently dropped.
	// Expressed in kb/sec. Can be overridden by the workspace config (smallest value wins).
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

	// A set of name-value pairs that sets or overrides environment variables for the workspace.
	// Environment may be referenced in the values.
	Env *orderedmap.OrderedMap

	// Prebuild configures the prebuild IDE process.
	Prebuild *struct {
		// Entrypoint is an IDE prebuild entrypoint, if omitted then IDE entrypoint
		Entrypoint string `json:"entrypoint"`
		// Args is an IDE entrypoint args
		Args []string `json:"args"`
		// Env is an IDE prebuild environment variables
		Env *map[string]interface{} `json:"env"`
	} `json:"prebuild"`
}

func (c IDEConfig) GetUniqueKey() string {
	return c.Name + "-" + c.Version
}

func (c IDEConfig) PrebuildTaskName() string {
	return "ide-prebuild-" + c.GetUniqueKey()
}

// Validate validates this configuration.
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

type WorkspaceClassInfo struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Description string `json:"description"`
}

func (i *WorkspaceClassInfo) UnmarshalEnvironmentValue(data string) error {
	var tmp WorkspaceClassInfo
	if err := json.Unmarshal([]byte(data), &tmp); err != nil {
		return err
	}
	*i = tmp
	return nil
}

func (i WorkspaceClassInfo) MarshalEnvironmentValue() (string, error) {
	bytes, err := json.Marshal(i)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// WorkspaceConfig is the workspace specific configuration. This config is drawn exclusively
// from environment variables.
type WorkspaceConfig struct {
	// WorkspaceContextURL is an URL for which workspace was created.
	WorkspaceContextURL string `env:"GITPOD_WORKSPACE_CONTEXT_URL"`

	// WorkspaceUrl is an URL for which workspace is accessed.
	WorkspaceUrl string `env:"GITPOD_WORKSPACE_URL"`

	// WorkspaceClass denotes the class of the workspace
	WorkspaceClass string `env:"GITPOD_WORKSPACE_CLASS"`

	// WorkspaceClassInfo denotes the detail of workspace class
	WorkspaceClassInfo *WorkspaceClassInfo `env:"GITPOD_WORKSPACE_CLASS_INFO"`

	// DefaultWorkspaceImage is the default image of current workspace
	DefaultWorkspaceImage string `env:"GITPOD_DEFAULT_WORKSPACE_IMAGE"`

	// IsSetJavaXmx is a flag to indicate if the JAVA_XMX environment variable is set
	// value retrieved from server with FeatureFlag
	IsSetJavaXmx bool `env:"GITPOD_IS_SET_JAVA_XMX"`

	// IsSetJavaProcessorCount is a flag to indicate if the JAVA_PROCESSOR_COUNT environment variable is set
	// value retrieved from server with FeatureFlag
	IsSetJavaProcessorCount bool `env:"GITPOD_IS_SET_JAVA_PROCESSOR_COUNT"`

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

	// RepoRoots is the comma separated list of locations in the filesystem where Git repositories
	// are located. If there's no Git repo in this workspace, this will be empty.
	RepoRoots string `env:"GITPOD_REPO_ROOTS"`

	// PreventMetadataAccess exits supervisor/stops the workspace if we can access Google Cloud
	// compute metadata from within the container.
	PreventMetadataAccess bool `env:"GITPOD_PREVENT_METADATA_ACCESS"`

	// LogRateLimit limits the log output of the IDE process.
	// Any output that exceeds this limit is silently dropped.
	// Expressed in kb/sec. Can be overridden by the IDE config (smallest value wins).
	WorkspaceLogRateLimit int `env:"THEIA_RATELIMIT_LOG"`

	// GitUsername makes supervisor configure the global user.name Git setting.
	GitUsername string `env:"GITPOD_GIT_USER_NAME"`
	// GitEmail makes supervisor configure the global user.email Git setting.
	GitEmail string `env:"GITPOD_GIT_USER_EMAIL"`

	// CommitAnnotationEnabled controls whether to annotate commits with the Gitpod instance host
	CommitAnnotationEnabled bool `env:"GITPOD_COMMIT_ANNOTATION_ENABLED"`

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

	// BobDockerfilePath is the path to the Dockerfile image builder will attempt to build
	BobDockerfilePath string `env:"BOB_DOCKERFILE_PATH"`

	// DebugEnabled controls whether the supervisor debugging facilities (pprof, grpc tracing) should be enabled
	DebugEnable bool `env:"SUPERVISOR_DEBUG_ENABLE"`

	// WorkspaceContext is a context for this workspace
	WorkspaceContext string `env:"GITPOD_WORKSPACE_CONTEXT"`

	// WorkspaceClusterHost is a host under which this workspace is served, e.g. ws-eu11.gitpod.io
	WorkspaceClusterHost string `env:"GITPOD_WORKSPACE_CLUSTER_HOST"`

	// DotfileRepo is a user-configurable repository which contains their dotfiles to customize
	// the in-workspace experience.
	DotfileRepo string `env:"SUPERVISOR_DOTFILE_REPO"`

	// EnvvarOTS points to a URL from which environment variables for child processes can be downloaded from.
	// This provides a safer means to transport environment variables compared to shipping them on the Kubernetes pod.
	//
	// The format of the content downloaded from this URL is expected to be JSON in the form of [{"name":"name", "value":"value"}]
	EnvvarOTS string `env:"SUPERVISOR_ENVVAR_OTS"`

	// TerminationGracePeriodSeconds is the max number of seconds the workspace can take to shut down all its processes after SIGTERM was sent.
	TerminationGracePeriodSeconds *int `env:"GITPOD_TERMINATION_GRACE_PERIOD_SECONDS"`

	// OwnerId is the user id who owns the workspace
	OwnerId string `env:"GITPOD_OWNER_ID"`

	// DebugWorkspaceType indicates whether it is a regular or prebuild debug workspace
	DebugWorkspaceType api.DebugWorkspaceType `env:"SUPERVISOR_DEBUG_WORKSPACE_TYPE"`

	// DebugWorkspaceContenSource indicates where the debug workspace content came from
	DebugWorkspaceContenSource api.ContentSource `env:"SUPERVISOR_DEBUG_WORKSPACE_CONTENT_SOURCE"`

	// ConfigcatEnabled controls whether configcat is enabled
	ConfigcatEnabled bool `env:"GITPOD_CONFIGCAT_ENABLED"`

	SSHGatewayCAPublicKey string `env:"GITPOD_SSH_CA_PUBLIC_KEY"`

	// Comma-separated list of host:<base64ed user:password> pairs to authenticate against docker registries
	GitpodImageAuth string `env:"GITPOD_IMAGE_AUTH"`
}

// WorkspaceGitpodToken is a list of tokens that should be added to supervisor's token service.
type WorkspaceGitpodToken struct {
	api.SetTokenRequest
	TokenOTS string `json:"tokenOTS"`
}

// TaskConfig defines gitpod task shape.
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

// Validate validates this configuration.
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

func (c Config) GetDesktopIDE() *IDEConfig {
	if len(c.DesktopIDEs) == 0 {
		return nil
	}
	return c.DesktopIDEs[0]
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

// GitpodAPIEndpoint produces the data required to connect to the Gitpod API.
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

// isPrebuild returns true if the workspace is prebuild.
func (c WorkspaceConfig) isPrebuild() bool {
	return c.GitpodHeadless == "true" || c.DebugWorkspaceType == api.DebugWorkspaceType_prebuild
}

// getGitpodTasks returns true if the workspace is headless.
func (c WorkspaceConfig) isHeadless() bool {
	return c.GitpodHeadless == "true"
}

// isDebugWorkspace returns true if the workspace is in debug mode.
func (c WorkspaceConfig) isDebugWorkspace() bool {
	return c.DebugWorkspaceType != api.DebugWorkspaceType_noDebug
}

// isImageBuild returns true if the workspace is an image build.
func (c WorkspaceConfig) isImageBuild() bool {
	return c.BobDockerfilePath != ""
}

var contentSources = map[api.ContentSource]csapi.WorkspaceInitSource{
	api.ContentSource_from_other:    csapi.WorkspaceInitFromOther,
	api.ContentSource_from_backup:   csapi.WorkspaceInitFromBackup,
	api.ContentSource_from_prebuild: csapi.WorkspaceInitFromPrebuild,
}

func (c WorkspaceConfig) GetDebugWorkspaceContentSource() csapi.WorkspaceInitSource {
	return contentSources[c.DebugWorkspaceContenSource]
}

// getGitpodTasks parses gitpod tasks.
func (c Config) getGitpodTasks() (tasks []TaskConfig, err error) {
	if c.GitpodTasks != "" {
		var configured *[]TaskConfig
		err = json.Unmarshal([]byte(c.GitpodTasks), &configured)
		if err != nil {
			return nil, xerrors.Errorf("cannot parse tasks: %w", err)
		}
		if configured != nil {
			tasks = append(tasks, *configured...)
		}
	}

	if c.isPrebuild() && c.isHeadless() {
		// if prebuild with running IDEs then there is going to be a race condition
		// between IDE itself and its prebuild
		var prevTaskID string
		for _, ideConfig := range c.DesktopIDEs {
			if ideConfig == nil || ideConfig.Prebuild == nil {
				continue
			}
			taskID := ideConfig.PrebuildTaskName()

			var before string
			if prevTaskID == "" {
				before = "/.supervisor/supervisor prepare-ide-prebuild"
			} else {
				before = fmt.Sprintf("/usr/bin/gp sync-await %s", prevTaskID)
			}
			prevTaskID = taskID

			entrypoint := ideConfig.Prebuild.Entrypoint
			if entrypoint == "" {
				entrypoint = ideConfig.Entrypoint
			}

			init := fmt.Sprintf("echo 'Prebuilding %s (%s) (%s)'; ", ideConfig.DisplayName, ideConfig.Version, ideConfig.GetUniqueKey())
			init += entrypoint
			for _, arg := range ideConfig.Prebuild.Args {
				init = init + " " + arg
			}
			init += fmt.Sprintf("; /usr/bin/gp sync-done %s", taskID)

			tasks = append(tasks, TaskConfig{
				Name:   &taskID,
				Before: &before,
				Init:   &init,
				Env:    ideConfig.Prebuild.Env,
			})
		}
	}
	return
}

// getCommit returns a commit from which this workspace was created.
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

func (c WorkspaceConfig) GetTerminationGracePeriod() time.Duration {
	defaultGracePeriod := 15 * time.Second
	if c.TerminationGracePeriodSeconds == nil || *c.TerminationGracePeriodSeconds <= 0 {
		return defaultGracePeriod
	}
	return time.Duration(*c.TerminationGracePeriodSeconds) * time.Second
}

// GetConfig loads the supervisor configuration.
func GetConfig() (*Config, error) {
	static, err := loadStaticConfigFromFile()
	if err != nil {
		return nil, err
	}

	ide, err := loadIDEConfigFromFile(static.IDEConfigLocation)
	if err != nil {
		return nil, err
	}
	desktopIDEs, err := loadDesktopIDEs(static)
	if err != nil {
		return nil, err
	}

	workspace, err := loadWorkspaceConfigFromEnv()
	if err != nil {
		return nil, err
	}

	return &Config{
		StaticConfig:    *static,
		IDE:             *ide,
		DesktopIDEs:     desktopIDEs,
		WorkspaceConfig: *workspace,
	}, nil
}

func loadDesktopIDEs(static *StaticConfig) ([]*IDEConfig, error) {
	if static.DesktopIDERoot == "" {
		return nil, nil
	}
	if _, err := os.Stat(static.DesktopIDERoot); os.IsNotExist(err) {
		return nil, nil
	}

	var desktopIDEs []*IDEConfig
	uniqueDesktopIDEs := make(map[string]struct{})

	// check root for backwards compatibility with older images, remove in the future
	desktopIDE, err := loadIDEConfigFromPath(static.DesktopIDERoot)
	if err != nil {
		return nil, err
	}
	if desktopIDE != nil {
		desktopIDEs = append(desktopIDEs, desktopIDE)
		uniqueDesktopIDEs[desktopIDE.GetUniqueKey()] = struct{}{}
	}

	files, err := os.ReadDir(static.DesktopIDERoot)
	if err != nil {
		return nil, err
	}
	for _, f := range files {
		if f.IsDir() {
			desktopIDE, err = loadIDEConfigFromPath(filepath.Join(static.DesktopIDERoot, f.Name()))
			if desktopIDE == nil {
				continue
			}
			if err != nil {
				return nil, err
			}
			_, alreadyPresent := uniqueDesktopIDEs[desktopIDE.GetUniqueKey()]
			if alreadyPresent {
				log.WithField("key", desktopIDE.GetUniqueKey()).Warn("ignoring duplicate desktop IDE")
				continue
			}
			desktopIDEs = append(desktopIDEs, desktopIDE)
			uniqueDesktopIDEs[desktopIDE.Name] = struct{}{}
		}
	}

	slices.SortFunc(desktopIDEs, func(a, b *IDEConfig) int {
		return strings.Compare(a.Name, b.Name)
	})

	return desktopIDEs, nil
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

// loadIDEConfigFromPath loads the IDE configuration from a directory.
func loadIDEConfigFromPath(dirPath string) (*IDEConfig, error) {
	ideConfigLocation := filepath.Join(dirPath, "supervisor-ide-config.json")
	if _, err := os.Stat(ideConfigLocation); !os.IsNotExist(err) {
		return loadIDEConfigFromFile(ideConfigLocation)
	}
	return nil, nil
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
	if res.Name == "" {
		res.Name = filepath.Base(filepath.Dir(fn))
	}
	if res.DisplayName == "" {
		res.DisplayName = res.Name
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
