package supervisor

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math"
	"os"
	"path/filepath"

	env "github.com/Netflix/go-env"
	"golang.org/x/xerrors"
)

const supervisorConfigFile = "supervisor-config.json"

// Supervisor's configuration is dictated by three different lifecycles/sources:
//   1. supervisor (static):
//                  there's some configuration that lives with supervisor and its "installation",
//                  For example the IDE config location depends on if supervisor comes from the
//                  node-daemon or is served via registry-facade.
//   2. IDE: Gitpod supports different IDEs, all of which have different configuration needs.
//   3. Workspace: which depends on the individual workspace, its content and configuration.

// Config configures supervisor
type Config struct {
	StaticConfig
	IDEConfig
	WorkspaceConfig
}

// Validate validates the configuration
func (c Config) Validate() error {
	if err := c.StaticConfig.Validate(); err != nil {
		return fmt.Errorf("static supervisor config is invalid: %w", err)
	}
	if err := c.IDEConfig.Validate(); err != nil {
		return fmt.Errorf("IDE config is invalid: %w", err)
	}
	if err := c.WorkspaceConfig.Validate(); err != nil {
		return fmt.Errorf("Workspace config is invalid: %w", err)
	}

	return nil
}

// LogRateLimit returns the log rate limit for the IDE process in kib/sec.
// If log rate limiting is disbaled, this function returns 0.
func (c Config) LogRateLimit() int {
	if c.WorkspaceLogRateLimit < c.IDELogRateLimit {
		return c.WorkspaceLogRateLimit
	}
	return c.IDELogRateLimit
}

// StaticConfig is the supervisor-wide configuration
type StaticConfig struct {
	// IDEConfigLocation is a path in the filesystem where to find the IDE configuration
	IDEConfigLocation string `json:"ideConfigLocation"`

	// FrontendLocation is a path in the filesystem where to find supervisor's frontend assets
	FrontendLocation string `json:"frontendLocation"`

	// APIEndpointPort is the port where to serve the API endpoint on
	APIEndpointPort int `json:"apiEndpointPort"`
}

// Validate validates this configuration
func (c StaticConfig) Validate() error {
	if c.IDEConfigLocation == "" {
		return fmt.Errorf("ideConfigLocation is required")
	}
	if c.FrontendLocation == "" {
		return fmt.Errorf("frontendLocation is required")
	}
	if !(0 < c.APIEndpointPort && c.APIEndpointPort <= math.MaxUint16) {
		return fmt.Errorf("apiEndpointPort must be between 0 and %d", math.MaxUint16)
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

	// LogRateLimit can be used to limit the log output of the IDE process.
	// Any output that exceeds this limit is silently dropped.
	// Expressed in kb/sec. Can be overriden by the workspace config (smallest value wins).
	IDELogRateLimit int `json:"logRateLimit"`

	// ReadinessProbe configures the probe used to serve the IDE status
	ReadinessProbe struct {
		// Type determines the type of readiness probe we'll use.
		// Defaults to process.
		Type ReadinessProbeType `json:"type"`

		// HTTPProbe configures the HTTP readiness probe.
		HTTPProbe struct {
			// Path is the path to make requests to. Defaults to "/"
			Path string `json:"path"`
		} `json:"http"`
	} `json:"readinessProbe"`
}

// Validate validates this configuration
func (c IDEConfig) Validate() error {
	if c.Entrypoint == "" {
		return fmt.Errorf("entrypoint is required")
	}
	if stat, err := os.Stat(c.Entrypoint); err != nil {
		return fmt.Errorf("invalid entrypoint: %w", err)
	} else if stat.IsDir() {
		return fmt.Errorf("entrypoint is a directory, but should be a file")
	}

	if c.IDELogRateLimit < 0 {
		return fmt.Errorf("logRateLimit must be >= 0")
	}

	return nil
}

// WorkspaceConfig is the workspace specific configuration. This config is drawn exclusively
// from environment variables.
type WorkspaceConfig struct {
	// IDEPort is the port at which the IDE will need to run on. This is not an IDE config
	// because Gitpod determines this port, not the IDE.
	IDEPort int `env:"GITPOD_THEIA_PORT"`

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
}

// Validate validates this configuration
func (c WorkspaceConfig) Validate() error {
	if !(0 < c.IDEPort && c.IDEPort <= math.MaxUint16) {
		return fmt.Errorf("GITPOD_THEIA_PORT must be between 0 and %d", math.MaxUint16)
	}

	if c.WorkspaceRoot == "" {
		return fmt.Errorf("THEIA_WORKSPACE_ROOT is required")
	}

	if c.WorkspaceLogRateLimit < 0 {
		return fmt.Errorf("logRateLimit must be >= 0")
	}

	return nil
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

	workspace, err := loadWorkspaceConfigFromEnv()
	if err != nil {
		return nil, err
	}

	return &Config{
		StaticConfig:    *static,
		IDEConfig:       *ide,
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
	fc, err := ioutil.ReadFile(loc)
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
