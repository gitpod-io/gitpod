// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"bytes"
	"html/template"
	iofs "io/fs"
	"net/url"
	"os"
	"path/filepath"
	"time"

	ozzo "github.com/go-ozzo/ozzo-validation"
	"github.com/go-ozzo/ozzo-validation/is"
	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/apimachinery/pkg/util/yaml"

	"github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/util"
	cntntcfg "github.com/gitpod-io/gitpod/content-service/api/config"
)

// DefaultWorkspaceClass is the name of the default workspace class
const DefaultWorkspaceClass = "g1-standard"

type osFS struct{}

func (*osFS) Open(name string) (iofs.File, error) {
	return os.Open(name)
}

// FS is used to load files referred to by this configuration.
// We use a library here to be able to test things properly.
var FS iofs.FS = &osFS{}

// ServiceConfiguration configures the ws-manager configuration
type ServiceConfiguration struct {
	Manager Configuration `json:"manager"`
	Content struct {
		Storage cntntcfg.StorageConfig `json:"storage"`
	} `json:"content"`
	RPCServer struct {
		Addr string `json:"addr"`
		TLS  struct {
			CA          string `json:"ca"`
			Certificate string `json:"crt"`
			PrivateKey  string `json:"key"`
		} `json:"tls"`
		RateLimits map[string]grpc.RateLimit `json:"ratelimits"`
	} `json:"rpcServer"`
	ImageBuilderProxy struct {
		TargetAddr string `json:"targetAddr"`
		TLS        struct {
			CA          string `json:"ca"`
			Certificate string `json:"crt"`
			PrivateKey  string `json:"key"`
		} `json:"tls"`
	} `json:"imageBuilderProxy"`

	PProf struct {
		Addr string `json:"addr"`
	} `json:"pprof"`
	Prometheus struct {
		Addr string `json:"addr"`
	} `json:"prometheus"`
	Health struct {
		Addr string `json:"addr"`
	} `json:"health"`
}

// Configuration is the configuration of the ws-manager
type Configuration struct {
	// Namespace is the kubernetes namespace the workspace manager operates in
	Namespace string `json:"namespace"`
	// SecretsNamespace is the kubernetes namespace which contains workspace secrets
	SecretsNamespace string `json:"secretsNamespace"`
	// SchedulerName is the name of the workspace scheduler all pods are created with
	SchedulerName string `json:"schedulerName"`
	// SeccompProfile names the seccomp profile workspaces will use
	SeccompProfile string `json:"seccompProfile"`
	// Timeouts configures how long workspaces can be without activity before they're shut down.
	// All values in here must be valid time.Duration
	Timeouts WorkspaceTimeoutConfiguration `json:"timeouts"`
	// InitProbe configures the ready-probe of workspaces which signal when the initialization is finished
	InitProbe InitProbeConfiguration `json:"initProbe"`
	// WorkspaceURLTemplate is a Go template which resolves to the external URL of the
	// workspace. Available fields are:
	// - `ID` which is the workspace ID,
	// - `Prefix` which is the workspace's service prefix
	// - `Host` which is the GitpodHostURL
	WorkspaceURLTemplate string `json:"urlTemplate"`
	// WorkspaceURLTemplate is a Go template which resolves to the external URL of the
	// workspace port. Available fields are:
	// - `ID` which is the workspace ID,
	// - `Prefix` which is the workspace's service prefix
	// - `Host` which is the GitpodHostURL
	// - `WorkspacePort` which is the workspace port
	// - `IngressPort` which is the publicly accessile port
	WorkspacePortURLTemplate string `json:"portUrlTemplate"`
	// HostPath is the path on the node where workspace data resides (ideally this is an SSD)
	WorkspaceHostPath string `json:"workspaceHostPath"`
	// HeartbeatInterval is the time in seconds in which Theia sends a heartbeat if the user is active
	HeartbeatInterval util.Duration `json:"heartbeatInterval"`
	// Is the URL under which Gitpod is installed (e.g. https://gitpod.io)
	GitpodHostURL string `json:"hostURL"`
	// EventTraceLog is a path to file where we'll write the monitor event trace log to
	EventTraceLog string `json:"eventTraceLog,omitempty"`
	// ReconnectionInterval configures the time we wait until we reconnect to the various other services
	ReconnectionInterval util.Duration `json:"reconnectionInterval"`
	// MaintenanceMode prevents start workspace, stop workspace, and take snapshot operations
	MaintenanceMode bool `json:"maintenanceMode,omitempty"`
	// WorkspaceDaemon configures our connection to the workspace sync daemons runnin on the nodes
	WorkspaceDaemon WorkspaceDaemonConfiguration `json:"wsdaemon"`
	// RegistryFacadeHost is the host (possibly including port) on which the registry facade resolves
	RegistryFacadeHost string `json:"registryFacadeHost"`
	// Cluster host under which workspaces are served, e.g. ws-eu11.gitpod.io
	WorkspaceClusterHost string `json:"workspaceClusterHost"`
	// WorkspaceClasses provide different resource classes for workspaces
	WorkspaceClasses map[string]*WorkspaceClass `json:"workspaceClass"`
	// PreferredWorkspaceClass is the name of the workspace class that should be used by default
	PreferredWorkspaceClass string `json:"preferredWorkspaceClass"`
	// DebugWorkspacePod adds extra finalizer to workspace to prevent it from shutting down. Helps to debug.
	DebugWorkspacePod bool `json:"debugWorkspacePod,omitempty"`
	// WorkspaceMaxConcurrentReconciles configures the max amount of concurrent workspace reconciliations on
	// the workspace controller.
	WorkspaceMaxConcurrentReconciles int `json:"workspaceMaxConcurrentReconciles,omitempty"`
	// TimeoutMaxConcurrentReconciles configures the max amount of concurrent workspace reconciliations on
	// the timeout controller.
	TimeoutMaxConcurrentReconciles int `json:"timeoutMaxConcurrentReconciles,omitempty"`
	// EnableCustomSSLCertificate controls if we need to support custom SSL certificates for git operations
	EnableCustomSSLCertificate bool `json:"enableCustomSSLCertificate"`
	// WorkspacekitImage points to the default workspacekit image
	WorkspacekitImage string `json:"workspacekitImage,omitempty"`

	SSHGatewayCAPublicKeyFile string `json:"sshGatewayCAPublicKeyFile,omitempty"`

	// SSHGatewayCAPublicKey is a CA public key
	SSHGatewayCAPublicKey string

	// PodRecreationMaxRetries
	PodRecreationMaxRetries int `json:"podRecreationMaxRetries,omitempty"`
	// PodRecreationBackoff
	PodRecreationBackoff util.Duration `json:"podRecreationBackoff,omitempty"`
}

type WorkspaceClass struct {
	Name        string                            `json:"name"`
	Description string                            `json:"description"`
	Container   ContainerConfiguration            `json:"container"`
	Templates   WorkspacePodTemplateConfiguration `json:"templates"`

	// CreditsPerMinute is the cost per minute for this workspace class in credits
	CreditsPerMinute float32 `json:"creditsPerMinute"`
}

// WorkspaceTimeoutConfiguration configures the timeout behaviour of workspaces
type WorkspaceTimeoutConfiguration struct {
	// TotalStartup is the total time a workspace can take until we expect the first activity
	TotalStartup util.Duration `json:"startup"`
	// Initialization is the time the initialization phase alone can take
	Initialization util.Duration `json:"initialization"`
	// RegularWorkspace is the time a regular workspace can be without activity before it's shutdown
	RegularWorkspace util.Duration `json:"regularWorkspace"`
	// MaxLifetime is the maximum lifetime of a regular workspace
	MaxLifetime util.Duration `json:"maxLifetime"`
	// HeadlessWorkspace is the maximum runtime a headless workspace can have (including startup)
	HeadlessWorkspace util.Duration `json:"headlessWorkspace"`
	// AfterClose is the time a workspace lives after it has been marked closed
	AfterClose util.Duration `json:"afterClose"`
	// ContentFinalization is the time in which the workspace's content needs to be backed up and removed from the node
	ContentFinalization util.Duration `json:"contentFinalization"`
	// Stopping is the time a workspace has until it has to be stopped. This time includes finalization, hence must be greater than
	// the ContentFinalization timeout.
	Stopping util.Duration `json:"stopping"`
	// Interrupted is the time a workspace may be interrupted (since it last saw activity or since it was created if it never saw any)
	Interrupted util.Duration `json:"interrupted"`
}

// InitProbeConfiguration configures the behaviour of the workspace ready probe
type InitProbeConfiguration struct {
	// Disabled disables the workspace init probe - this is only neccesary during tests and in noDomain environments.
	Disabled bool `json:"disabled,omitempty"`

	// Timeout is the HTTP GET timeout during each probe attempt. Defaults to 5 seconds.
	Timeout string `json:"timeout,omitempty"`
}

// WorkspacePodTemplateConfiguration configures the paths to workspace pod templates
type WorkspacePodTemplateConfiguration struct {
	// DefaultPath is a path to a workspace pod template YAML file that's used for
	// all workspaces irregardles of their type. If a type-specific template is configured
	// as well, that template is merged in, too.
	DefaultPath string `json:"defaultPath,omitempty"`
	// RegularPath is a path to an additional workspace pod template YAML file for regular workspaces
	RegularPath string `json:"regularPath,omitempty"`
	// PrebuildPath is a path to an additional workspace pod template YAML file for prebuild workspaces
	PrebuildPath string `json:"prebuildPath,omitempty"`
	// ProbePath is a path to an additional workspace pod template YAML file for probe workspaces
	// Deprecated
	ProbePath string `json:"probePath,omitempty"`
	// ImagebuildPath is a path to an additional workspace pod template YAML file for imagebuild workspaces
	ImagebuildPath string `json:"imagebuildPath,omitempty"`
}

// WorkspaceDaemonConfiguration configures our connection to the workspace sync daemons runnin on the nodes
type WorkspaceDaemonConfiguration struct {
	// Port is the port on the node on which the ws-daemon is listening
	Port int `json:"port"`
	// TLS is the certificate/key config to connect to ws-daemon
	TLS struct {
		// Authority is the root certificate that was used to sign the certificate itself
		Authority string `json:"ca"`
		// Certificate is the crt file, the actual certificate
		Certificate string `json:"crt"`
		// PrivateKey is the private key in order to use the certificate
		PrivateKey string `json:"key"`
	} `json:"tls"`
}

// Validate validates the configuration to catch issues during startup and not at runtime
func (c *Configuration) Validate() error {
	err := ozzo.ValidateStruct(&c.Timeouts,
		ozzo.Field(&c.Timeouts.AfterClose, ozzo.Required),
		ozzo.Field(&c.Timeouts.HeadlessWorkspace, ozzo.Required),
		ozzo.Field(&c.Timeouts.Initialization, ozzo.Required),
		ozzo.Field(&c.Timeouts.RegularWorkspace, ozzo.Required),
		ozzo.Field(&c.Timeouts.MaxLifetime, ozzo.Required),
		ozzo.Field(&c.Timeouts.TotalStartup, ozzo.Required),
		ozzo.Field(&c.Timeouts.ContentFinalization, ozzo.Required),
		ozzo.Field(&c.Timeouts.Stopping, ozzo.Required),
	)
	if err != nil {
		return xerrors.Errorf("timeouts: %w", err)
	}
	if c.Timeouts.Stopping < c.Timeouts.ContentFinalization {
		return xerrors.Errorf("stopping timeout must be greater than content finalization timeout")
	}

	err = ozzo.ValidateStruct(c,
		ozzo.Field(&c.WorkspaceURLTemplate, ozzo.Required, validWorkspaceURLTemplate),
		ozzo.Field(&c.WorkspaceHostPath, ozzo.Required),
		ozzo.Field(&c.HeartbeatInterval, ozzo.Required),
		ozzo.Field(&c.GitpodHostURL, ozzo.Required, is.URL),
		ozzo.Field(&c.ReconnectionInterval, ozzo.Required),
	)
	if err != nil {
		return err
	}

	if _, ok := c.WorkspaceClasses[DefaultWorkspaceClass]; !ok {
		return xerrors.Errorf("missing \"%s\" workspace class", DefaultWorkspaceClass)
	}
	for name, class := range c.WorkspaceClasses {
		if errs := validation.IsValidLabelValue(name); len(errs) > 0 {
			return xerrors.Errorf("workspace class name \"%s\" is invalid: %v", name, errs)
		}
		if err := class.Container.Validate(); err != nil {
			return xerrors.Errorf("workspace class %s: %w", name, err)
		}

		err = ozzo.ValidateStruct(&class.Templates,
			ozzo.Field(&class.Templates.DefaultPath, validPodTemplate),
			ozzo.Field(&class.Templates.PrebuildPath, validPodTemplate),
			ozzo.Field(&class.Templates.ProbePath, validPodTemplate),
			ozzo.Field(&class.Templates.RegularPath, validPodTemplate),
		)
		if err != nil {
			return xerrors.Errorf("workspace class %s: %w", name, err)
		}
	}

	return err
}

var validPodTemplate = ozzo.By(func(o interface{}) error {
	s, ok := o.(string)
	if !ok {
		return xerrors.Errorf("field should be string")
	}

	_, err := GetWorkspacePodTemplate(s)
	return err
})

var validWorkspaceURLTemplate = ozzo.By(func(o interface{}) error {
	s, ok := o.(string)
	if !ok {
		return xerrors.Errorf("field should be string")
	}

	wsurl, err := RenderWorkspaceURL(s, "foo", "bar", "gitpod.io")
	if err != nil {
		return xerrors.Errorf("cannot render URL: %w", err)
	}
	_, err = url.Parse(wsurl)
	if err != nil {
		return xerrors.Errorf("not a valid URL: %w", err)
	}

	return err
})

// ContainerConfiguration configures properties of workspace pod container
type ContainerConfiguration struct {
	Requests *ResourceRequestConfiguration `json:"requests,omitempty"`
	Limits   *ResourceLimitConfiguration   `json:"limits,omitempty"`
}

// Validate validates a container configuration
func (c *ContainerConfiguration) Validate() error {
	return ozzo.ValidateStruct(c,
		ozzo.Field(&c.Requests, validResourceRequestConfig),
		ozzo.Field(&c.Limits, validResourceLimitConfig),
	)
}

var validResourceRequestConfig = ozzo.By(func(o interface{}) error {
	rc, ok := o.(*ResourceRequestConfiguration)
	if !ok {
		return xerrors.Errorf("can only validate ResourceRequestConfiguration")
	}
	if rc == nil {
		return nil
	}
	if rc.CPU != "" {
		_, err := resource.ParseQuantity(rc.CPU)
		if err != nil {
			return xerrors.Errorf("cannot parse CPU quantity: %w", err)
		}
	}
	if rc.Memory != "" {
		_, err := resource.ParseQuantity(rc.Memory)
		if err != nil {
			return xerrors.Errorf("cannot parse Memory quantity: %w", err)
		}
	}
	if rc.EphemeralStorage != "" {
		_, err := resource.ParseQuantity(rc.EphemeralStorage)
		if err != nil {
			return xerrors.Errorf("cannot parse EphemeralStorage quantity: %w", err)
		}
	}
	if rc.Storage != "" {
		_, err := resource.ParseQuantity(rc.Storage)
		if err != nil {
			return xerrors.Errorf("cannot parse Storage quantity: %w", err)
		}
	}
	return nil
})

var validResourceLimitConfig = ozzo.By(func(o interface{}) error {
	rc, ok := o.(*ResourceLimitConfiguration)
	if !ok {
		return xerrors.Errorf("can only validate ResourceLimitConfiguration")
	}
	if rc == nil {
		return nil
	}
	if rc.CPU.MinLimit != "" {
		_, err := resource.ParseQuantity(rc.CPU.MinLimit)
		if err != nil {
			return xerrors.Errorf("cannot parse low limit CPU quantity: %w", err)
		}
	}
	if rc.CPU.BurstLimit != "" {
		_, err := resource.ParseQuantity(rc.CPU.BurstLimit)
		if err != nil {
			return xerrors.Errorf("cannot parse burst limit CPU quantity: %w", err)
		}
	}
	if rc.Memory != "" {
		_, err := resource.ParseQuantity(rc.Memory)
		if err != nil {
			return xerrors.Errorf("cannot parse Memory quantity: %w", err)
		}
	}
	if rc.EphemeralStorage != "" {
		_, err := resource.ParseQuantity(rc.EphemeralStorage)
		if err != nil {
			return xerrors.Errorf("cannot parse EphemeralStorage quantity: %w", err)
		}
	}
	if rc.Storage != "" {
		_, err := resource.ParseQuantity(rc.Storage)
		if err != nil {
			return xerrors.Errorf("cannot parse Storage quantity: %w", err)
		}
	}
	return nil
})

func (r *ResourceRequestConfiguration) StorageQuantity() (resource.Quantity, error) {
	if r.Storage == "" {
		res := resource.NewQuantity(0, resource.BinarySI)
		return *res, nil
	}
	return resource.ParseQuantity(r.Storage)
}

// ResourceList parses the quantities in the resource config
func (r *ResourceRequestConfiguration) ResourceList() (corev1.ResourceList, error) {
	if r == nil {
		return corev1.ResourceList{}, nil
	}
	res := map[corev1.ResourceName]string{
		corev1.ResourceCPU:              r.CPU,
		corev1.ResourceMemory:           r.Memory,
		corev1.ResourceEphemeralStorage: r.EphemeralStorage,
	}

	var l = make(corev1.ResourceList)
	for k, v := range res {
		if v == "" {
			continue
		}

		q, err := resource.ParseQuantity(v)
		if err != nil {
			return nil, xerrors.Errorf("%s: %w", k, err)
		}
		if q.Value() == 0 {
			continue
		}

		l[k] = q
	}
	return l, nil
}

// GetWorkspacePodTemplate parses a pod template YAML file. Returns nil if path is empty.
func GetWorkspacePodTemplate(filename string) (*corev1.Pod, error) {
	if filename == "" {
		return nil, nil
	}

	tpr := os.Getenv("TELEPRESENCE_ROOT")
	if tpr != "" {
		filename = filepath.Join(tpr, filename)
	}

	tpl, err := FS.Open(filename)
	if err != nil {
		return nil, xerrors.Errorf("cannot read pod template: %w", err)
	}
	defer tpl.Close()

	var res corev1.Pod
	decoder := yaml.NewYAMLOrJSONDecoder(tpl, 4096)
	err = decoder.Decode(&res)
	if err != nil {
		return nil, xerrors.Errorf("cannot unmarshal pod template: %w", err)
	}

	return &res, nil
}

// RenderWorkspaceURL takes a workspace URL template and renders it
func RenderWorkspaceURL(urltpl, id, servicePrefix, host string) (string, error) {
	tpl, err := template.New("url").Parse(urltpl)
	if err != nil {
		return "", xerrors.Errorf("cannot compute workspace URL: %w", err)
	}

	type data struct {
		ID     string
		Prefix string
		Host   string
	}
	d := data{
		ID:     id,
		Prefix: servicePrefix,
		Host:   host,
	}

	var b bytes.Buffer
	err = tpl.Execute(&b, d)
	if err != nil {
		return "", xerrors.Errorf("cannot compute workspace URL: %w", err)
	}

	return b.String(), nil
}

type PortURLContext struct {
	ID            string
	Prefix        string
	Host          string
	WorkspacePort string
	IngressPort   string
}

// RenderWorkspacePortURL takes a workspace port URL template and renders it
func RenderWorkspacePortURL(urltpl string, ctx PortURLContext) (string, error) {
	tpl, err := template.New("url").Parse(urltpl)
	if err != nil {
		return "", xerrors.Errorf("cannot compute workspace URL: %w", err)
	}

	var b bytes.Buffer
	err = tpl.Execute(&b, ctx)
	if err != nil {
		return "", xerrors.Errorf("cannot compute workspace port URL: %w", err)
	}

	return b.String(), nil
}

// ResourceRequestConfiguration configures resources of a pod/container
type ResourceRequestConfiguration struct {
	CPU              string `json:"cpu"`
	Memory           string `json:"memory"`
	EphemeralStorage string `json:"ephemeral-storage"`
	Storage          string `json:"storage,omitempty"`
}

type ResourceLimitConfiguration struct {
	CPU              *CpuResourceLimit `json:"cpu"`
	Memory           string            `json:"memory"`
	EphemeralStorage string            `json:"ephemeral-storage"`
	Storage          string            `json:"storage,omitempty"`
}

func (r *ResourceLimitConfiguration) ResourceList() (corev1.ResourceList, error) {
	if r == nil {
		return corev1.ResourceList{}, nil
	}
	res := map[corev1.ResourceName]string{
		corev1.ResourceMemory:           r.Memory,
		corev1.ResourceEphemeralStorage: r.EphemeralStorage,
	}

	if r.CPU != nil {
		res[corev1.ResourceCPU] = r.CPU.BurstLimit
	}

	var l = make(corev1.ResourceList)
	for k, v := range res {
		if v == "" {
			continue
		}

		q, err := resource.ParseQuantity(v)
		if err != nil {
			return nil, xerrors.Errorf("%s: %w", k, err)
		}
		if q.Value() == 0 {
			continue
		}

		l[k] = q
	}
	return l, nil
}

func (r *ResourceLimitConfiguration) StorageQuantity() (resource.Quantity, error) {
	if r.Storage == "" {
		res := resource.NewQuantity(0, resource.BinarySI)
		return *res, nil
	}
	return resource.ParseQuantity(r.Storage)
}

type CpuResourceLimit struct {
	MinLimit   string `json:"min"`
	BurstLimit string `json:"burst"`
}

type MaintenanceConfig struct {
	EnabledUntil *time.Time `json:"enabledUntil"`
}
