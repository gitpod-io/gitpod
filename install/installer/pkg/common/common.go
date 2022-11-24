// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"strconv"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"
	"sigs.k8s.io/yaml"
)

// getProxyServerEnvvar get the proxy server envvars in both upper and lowercase form for maximum compatiblity
func getProxyServerEnvvar(cfg *config.Config, envvarName string, key string) []corev1.EnvVar {
	env := corev1.EnvVar{
		Name: strings.ToUpper(envvarName),
		ValueFrom: &corev1.EnvVarSource{
			SecretKeyRef: &corev1.SecretKeySelector{
				LocalObjectReference: corev1.LocalObjectReference{
					Name: cfg.HTTPProxy.Name,
				},
				Key:      key,
				Optional: pointer.Bool(true),
			},
		},
	}

	return []corev1.EnvVar{
		env,
		func() corev1.EnvVar {
			envLower := env.DeepCopy()
			envLower.Name = strings.ToLower(envvarName)

			return *envLower
		}(),
	}
}

func DefaultLabels(component string) map[string]string {
	return map[string]string{
		"app":       AppName,
		"component": component,
	}
}

func MergeEnv(envs ...[]corev1.EnvVar) (res []corev1.EnvVar) {
	for _, e := range envs {
		res = append(res, e...)
	}
	return
}

func ProxyEnv(cfg *config.Config) []corev1.EnvVar {
	if cfg.HTTPProxy == nil {
		return []corev1.EnvVar{}
	}

	// The hard-coded values are the gRPC service names and the licence server
	noProxyValue := "ws-manager,wsdaemon,$(CUSTOM_NO_PROXY)"

	return MergeEnv(
		getProxyServerEnvvar(cfg, "HTTP_PROXY", "httpProxy"),
		getProxyServerEnvvar(cfg, "HTTPS_PROXY", "httpsProxy"),
		getProxyServerEnvvar(cfg, "CUSTOM_NO_PROXY", "noProxy"),
		[]corev1.EnvVar{
			// This must come after the CUSTOM_NO_PROXY definition
			{Name: "NO_PROXY", Value: noProxyValue},
			{Name: "no_proxy", Value: noProxyValue},
		},
	)
}

func DefaultEnv(cfg *config.Config) []corev1.EnvVar {
	logLevel := "info"
	if cfg.Observability.LogLevel != "" {
		logLevel = string(cfg.Observability.LogLevel)
	}

	return MergeEnv(
		[]corev1.EnvVar{
			{Name: "GITPOD_DOMAIN", Value: cfg.Domain},
			{Name: "GITPOD_INSTALLATION_SHORTNAME", Value: cfg.Metadata.InstallationShortname},
			{Name: "GITPOD_REGION", Value: cfg.Metadata.Region},
			{Name: "HOST_URL", Value: "https://" + cfg.Domain},
			{Name: "KUBE_NAMESPACE", ValueFrom: &corev1.EnvVarSource{
				FieldRef: &corev1.ObjectFieldSelector{
					FieldPath: "metadata.namespace",
				},
			}},
			{Name: "KUBE_DOMAIN", Value: "svc.cluster.local"},
			{Name: "LOG_LEVEL", Value: strings.ToLower(logLevel)},
		},
		ProxyEnv(cfg),
	)
}

func WorkspaceTracingEnv(context *RenderContext, component string) (res []corev1.EnvVar) {
	var tracing *experimental.Tracing

	_ = context.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.Workspace != nil {
			tracing = cfg.Workspace.Tracing
		}
		return nil
	})

	return tracingEnv(context, component, tracing)
}

func WebappTracingEnv(context *RenderContext, component string) (res []corev1.EnvVar) {
	var tracing *experimental.Tracing

	_ = context.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil {
			tracing = cfg.WebApp.Tracing
		}
		return nil
	})

	return tracingEnv(context, component, tracing)
}

func tracingEnv(context *RenderContext, component string, tracing *experimental.Tracing) (res []corev1.EnvVar) {
	if context.Config.Observability.Tracing == nil {
		res = append(res, corev1.EnvVar{Name: "JAEGER_DISABLED", Value: "true"})
		return
	}

	if ep := context.Config.Observability.Tracing.Endpoint; ep != nil {
		res = append(res, corev1.EnvVar{Name: "JAEGER_ENDPOINT", Value: *ep})
	} else if v := context.Config.Observability.Tracing.AgentHost; v != nil {
		res = append(res, corev1.EnvVar{Name: "JAEGER_AGENT_HOST", Value: *v})
	} else {
		// TODO(cw): think about proper error handling here.
		//			 Returning an error would be the appropriate thing to do,
		//			 but would make env var composition more cumbersome.
	}

	if context.Config.Observability.Tracing.SecretName != nil {
		res = append(res, corev1.EnvVar{
			Name: "JAEGER_USER",
			ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
				LocalObjectReference: corev1.LocalObjectReference{Name: *context.Config.Observability.Tracing.SecretName},
				Key:                  "JAEGER_USER",
			}},
		})

		res = append(res, corev1.EnvVar{
			Name: "JAEGER_PASSWORD",
			ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
				LocalObjectReference: corev1.LocalObjectReference{Name: *context.Config.Observability.Tracing.SecretName},
				Key:                  "JAEGER_PASSWORD",
			}},
		})
	}

	res = append(res, corev1.EnvVar{Name: "JAEGER_SERVICE_NAME", Value: component})

	jaegerTags := []string{}
	if context.Config.Metadata.InstallationShortname != "" {
		jaegerTags = append(jaegerTags, fmt.Sprintf("cluster=%v", context.Config.Metadata.InstallationShortname))
	}

	if context.Config.Metadata.Region != "" {
		jaegerTags = append(jaegerTags, fmt.Sprintf("region=%v", context.Config.Metadata.Region))
	}

	if len(jaegerTags) > 0 {
		res = append(res,
			corev1.EnvVar{Name: "JAEGER_TAGS", Value: strings.Join(jaegerTags, ",")},
		)
	}

	samplerType := experimental.TracingSampleTypeConst
	samplerParam := "1"

	if tracing != nil {
		if tracing.SamplerType != nil {
			samplerType = *tracing.SamplerType
		}
		if tracing.SamplerParam != nil {
			samplerParam = strconv.FormatFloat(*tracing.SamplerParam, 'f', -1, 64)
		}
	}

	res = append(res,
		corev1.EnvVar{Name: "JAEGER_SAMPLER_TYPE", Value: string(samplerType)},
		corev1.EnvVar{Name: "JAEGER_SAMPLER_PARAM", Value: samplerParam},
	)

	return
}

func AnalyticsEnv(cfg *config.Config) (res []corev1.EnvVar) {
	if cfg.Analytics == nil {
		return
	}

	return []corev1.EnvVar{{
		Name:  "GITPOD_ANALYTICS_WRITER",
		Value: cfg.Analytics.Writer,
	}, {
		Name:  "GITPOD_ANALYTICS_SEGMENT_KEY",
		Value: cfg.Analytics.SegmentKey,
	}}
}

func MessageBusEnv(_ *config.Config) (res []corev1.EnvVar) {
	clusterObj := corev1.LocalObjectReference{Name: InClusterMessageQueueName}
	tlsObj := corev1.LocalObjectReference{Name: InClusterMessageQueueTLS}

	return []corev1.EnvVar{{
		Name: "MESSAGEBUS_USERNAME",
		ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
			LocalObjectReference: clusterObj,
			Key:                  "username",
		}},
	}, {
		Name: "MESSAGEBUS_PASSWORD",
		ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
			LocalObjectReference: clusterObj,
			Key:                  "password",
		}},
	}, {
		Name: "MESSAGEBUS_CA",
		ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
			LocalObjectReference: tlsObj,
			Key:                  "ca.crt",
		}},
	}, {
		Name: "MESSAGEBUS_CERT",
		ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
			LocalObjectReference: tlsObj,
			Key:                  "tls.crt",
		}},
	}, {
		Name: "MESSAGEBUS_KEY",
		ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
			LocalObjectReference: tlsObj,
			Key:                  "tls.key",
		}},
	}}
}

func DatabaseEnv(cfg *config.Config) (res []corev1.EnvVar) {
	var (
		secretRef corev1.LocalObjectReference
		envvars   []corev1.EnvVar
	)

	if pointer.BoolDeref(cfg.Database.InCluster, false) {
		secretRef = corev1.LocalObjectReference{Name: InClusterDbSecret}
		envvars = append(envvars,
			corev1.EnvVar{
				Name: "DB_HOST",
				ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
					LocalObjectReference: secretRef,
					Key:                  "host",
				}},
			},
			corev1.EnvVar{
				Name: "DB_PORT",
				ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
					LocalObjectReference: secretRef,
					Key:                  "port",
				}},
			},
		)
	} else if cfg.Database.External != nil && cfg.Database.External.Certificate.Name != "" {
		// External DB
		secretRef = corev1.LocalObjectReference{Name: cfg.Database.External.Certificate.Name}
		envvars = append(envvars,
			corev1.EnvVar{
				Name: "DB_HOST",
				ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
					LocalObjectReference: secretRef,
					Key:                  "host",
				}},
			},
			corev1.EnvVar{
				Name: "DB_PORT",
				ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
					LocalObjectReference: secretRef,
					Key:                  "port",
				}},
			},
		)
	} else if cfg.Database.CloudSQL != nil && cfg.Database.CloudSQL.ServiceAccount.Name != "" {
		// GCP
		secretRef = corev1.LocalObjectReference{Name: cfg.Database.CloudSQL.ServiceAccount.Name}
		envvars = append(envvars,
			corev1.EnvVar{
				Name:  "DB_HOST",
				Value: "cloudsqlproxy",
			},
			corev1.EnvVar{
				Name:  "DB_PORT",
				Value: "3306",
			},
		)
	} else {
		panic("invalid database configuration")
	}

	envvars = append(envvars,
		corev1.EnvVar{
			Name: "DB_PASSWORD",
			ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
				LocalObjectReference: secretRef,
				Key:                  "password",
			}},
		},
		corev1.EnvVar{
			Name: "DB_USERNAME",
			ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
				LocalObjectReference: secretRef,
				Key:                  "username",
			}},
		},
		corev1.EnvVar{
			Name: "DB_ENCRYPTION_KEYS",
			ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
				LocalObjectReference: secretRef,
				Key:                  "encryptionKeys",
			}},
		},
	)

	return envvars
}

func ConfigcatEnv(ctx *RenderContext) []corev1.EnvVar {
	var sdkKey string
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.ConfigcatKey != "" {
			sdkKey = cfg.WebApp.ConfigcatKey
		}
		return nil
	})

	if sdkKey == "" {
		return nil
	}

	return []corev1.EnvVar{
		{
			Name:  "CONFIGCAT_SDK_KEY",
			Value: sdkKey,
		},
	}
}

func ConfigcatProxyEnv(ctx *RenderContext) []corev1.EnvVar {
	var (
		sdkKey       string
		baseUrl      string
		pollInterval string
	)
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.ConfigcatKey != "" {
			sdkKey = cfg.WebApp.ConfigcatKey
		}
		if cfg.WebApp != nil && cfg.WebApp.ProxyConfig != nil && cfg.WebApp.ProxyConfig.Configcat != nil {
			baseUrl = cfg.WebApp.ProxyConfig.Configcat.BaseUrl
			pollInterval = cfg.WebApp.ProxyConfig.Configcat.PollInterval
		}
		return nil
	})

	if sdkKey == "" {
		return nil
	}

	return []corev1.EnvVar{
		{
			Name:  "CONFIGCAT_SDK_KEY",
			Value: sdkKey,
		},
		{
			Name:  "CONFIGCAT_BASE_URL",
			Value: baseUrl,
		},
		{
			Name:  "CONFIGCAT_POLL_INTERVAL",
			Value: pollInterval,
		},
	}
}

func DatabaseWaiterContainer(ctx *RenderContext) *corev1.Container {
	return &corev1.Container{
		Name:  "database-waiter",
		Image: ctx.ImageName(ctx.Config.Repository, "service-waiter", ctx.VersionManifest.Components.ServiceWaiter.Version),
		Args: []string{
			"-v",
			"database",
		},
		SecurityContext: &corev1.SecurityContext{
			Privileged:               pointer.Bool(false),
			AllowPrivilegeEscalation: pointer.Bool(false),
			RunAsUser:                pointer.Int64(31001),
		},
		Env: MergeEnv(
			DatabaseEnv(&ctx.Config),
			ProxyEnv(&ctx.Config),
		),
	}
}

func MessageBusWaiterContainer(ctx *RenderContext) *corev1.Container {
	return &corev1.Container{
		Name:  "msgbus-waiter",
		Image: ctx.ImageName(ctx.Config.Repository, "service-waiter", ctx.VersionManifest.Components.ServiceWaiter.Version),
		Args: []string{
			"-v",
			"messagebus",
		},
		SecurityContext: &corev1.SecurityContext{
			Privileged:               pointer.Bool(false),
			AllowPrivilegeEscalation: pointer.Bool(false),
			RunAsUser:                pointer.Int64(31001),
		},
		Env: MergeEnv(
			MessageBusEnv(&ctx.Config),
			ProxyEnv(&ctx.Config),
		),
	}
}

func KubeRBACProxyContainer(ctx *RenderContext) *corev1.Container {
	return KubeRBACProxyContainerWithConfig(ctx)
}

func KubeRBACProxyContainerWithConfig(ctx *RenderContext) *corev1.Container {
	return &corev1.Container{
		Name:  "kube-rbac-proxy",
		Image: ctx.ImageName(ThirdPartyContainerRepo(ctx.Config.Repository, KubeRBACProxyRepo), KubeRBACProxyImage, KubeRBACProxyTag),
		Args: []string{
			"--logtostderr",
			fmt.Sprintf("--insecure-listen-address=[$(IP)]:%d", baseserver.BuiltinMetricsPort),
			fmt.Sprintf("--upstream=http://127.0.0.1:%d/", baseserver.BuiltinMetricsPort),
		},
		Ports: []corev1.ContainerPort{
			{Name: baseserver.BuiltinMetricsPortName, ContainerPort: baseserver.BuiltinMetricsPort},
		},
		Env: MergeEnv(
			[]corev1.EnvVar{
				{
					Name: "IP",
					ValueFrom: &corev1.EnvVarSource{
						FieldRef: &corev1.ObjectFieldSelector{
							FieldPath: "status.podIP",
						},
					},
				},
			},
			ProxyEnv(&ctx.Config),
		),
		Resources: corev1.ResourceRequirements{Requests: corev1.ResourceList{
			corev1.ResourceCPU:    resource.MustParse("1m"),
			corev1.ResourceMemory: resource.MustParse("30Mi"),
		}},
		TerminationMessagePolicy: corev1.TerminationMessageFallbackToLogsOnError,
		SecurityContext: &corev1.SecurityContext{
			AllowPrivilegeEscalation: pointer.Bool(false),
			RunAsUser:                pointer.Int64(65532),
			RunAsGroup:               pointer.Int64(65532),
			RunAsNonRoot:             pointer.Bool(true),
		},
	}
}

func NodeAffinity(orLabels ...string) *corev1.Affinity {
	var terms []corev1.NodeSelectorTerm
	for _, lbl := range orLabels {
		terms = append(terms, corev1.NodeSelectorTerm{
			MatchExpressions: []corev1.NodeSelectorRequirement{
				{
					Key:      lbl,
					Operator: corev1.NodeSelectorOpExists,
				},
			},
		})
	}

	return &corev1.Affinity{
		NodeAffinity: &corev1.NodeAffinity{
			RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
				NodeSelectorTerms: terms,
			},
		},
	}
}

func IsDatabaseMigrationDisabled(ctx *RenderContext) bool {
	disableMigration := false
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil {
			disableMigration = cfg.WebApp.DisableMigration
		}
		return nil
	})
	return disableMigration
}

func Replicas(ctx *RenderContext, component string) *int32 {
	replicas := int32(1)

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.Common != nil && cfg.Common.PodConfig[component] != nil {
			if cfg.Common.PodConfig[component].Replicas != nil {
				replicas = *cfg.Common.PodConfig[component].Replicas
			}
		}
		return nil
	})
	return &replicas
}

func ResourceRequirements(ctx *RenderContext, component, containerName string, defaults corev1.ResourceRequirements) corev1.ResourceRequirements {
	resources := defaults

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.Common != nil && cfg.Common.PodConfig[component] != nil {
			if cfg.Common.PodConfig[component].Resources[containerName] != nil {
				resources = *cfg.Common.PodConfig[component].Resources[containerName]
			}
		}
		return nil
	})

	return resources
}

// ObjectHash marshals the objects to YAML and produces a sha256 hash of the output.
// This function is useful for restarting pods when the config changes.
// Takes an error as argument to make calling it more conventient. If that error is not nil,
// it's passed right through
func ObjectHash(objs []runtime.Object, err error) (string, error) {
	if err != nil {
		return "", err
	}

	hash := sha256.New()
	for _, o := range objs {
		b, err := yaml.Marshal(o)
		if err != nil {
			return "", err
		}
		_, _ = hash.Write(b)
	}
	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

var (
	TCPProtocol = func() *corev1.Protocol {
		tcpProtocol := corev1.ProtocolTCP
		return &tcpProtocol
	}()
	PrometheusIngressRule = networkingv1.NetworkPolicyIngressRule{
		Ports: []networkingv1.NetworkPolicyPort{
			{
				Protocol: TCPProtocol,
				Port:     &intstr.IntOrString{IntVal: baseserver.BuiltinMetricsPort},
			},
		},
		From: []networkingv1.NetworkPolicyPeer{
			{
				// todo(sje): add these labels to the prometheus instance
				PodSelector: &metav1.LabelSelector{
					MatchLabels: map[string]string{
						"app":       "prometheus",
						"component": "server",
					},
				},
			},
		},
	}
)

var DeploymentStrategy = appsv1.DeploymentStrategy{
	Type: appsv1.RollingUpdateDeploymentStrategyType,
	RollingUpdate: &appsv1.RollingUpdateDeployment{
		MaxSurge:       &intstr.IntOrString{IntVal: 1},
		MaxUnavailable: &intstr.IntOrString{IntVal: 0},
	},
}

// TODO(cw): find a better way to do this. Those values must exist in the appropriate places already.
var (
	TypeMetaNamespace = metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "namespace",
	}
	TypeMetaStatefulSet = metav1.TypeMeta{
		APIVersion: "apps/v1",
		Kind:       "StatefulSet",
	}
	TypeMetaConfigmap = metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "ConfigMap",
	}
	TypeMetaServiceAccount = metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "ServiceAccount",
	}
	TypeMetaPod = metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "Pod",
	}
	TypeMetaDaemonset = metav1.TypeMeta{
		APIVersion: "apps/v1",
		Kind:       "DaemonSet",
	}
	TypeMetaService = metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "Service",
	}
	TypeMetaClusterRole = metav1.TypeMeta{
		APIVersion: "rbac.authorization.k8s.io/v1",
		Kind:       "ClusterRole",
	}
	TypeMetaClusterRoleBinding = metav1.TypeMeta{
		APIVersion: "rbac.authorization.k8s.io/v1",
		Kind:       "ClusterRoleBinding",
	}
	TypeMetaRoleBinding = metav1.TypeMeta{
		APIVersion: "rbac.authorization.k8s.io/v1",
		Kind:       "RoleBinding",
	}
	TypeMetaRole = metav1.TypeMeta{
		APIVersion: "rbac.authorization.k8s.io/v1",
		Kind:       "Role",
	}
	TypeMetaNetworkPolicy = metav1.TypeMeta{
		APIVersion: "networking.k8s.io/v1",
		Kind:       "NetworkPolicy",
	}
	TypeMetaDeployment = metav1.TypeMeta{
		APIVersion: "apps/v1",
		Kind:       "Deployment",
	}
	TypeMetaCertificate = metav1.TypeMeta{
		APIVersion: "cert-manager.io/v1",
		Kind:       "Certificate",
	}
	TypeMetaCertificateIssuer = metav1.TypeMeta{
		APIVersion: "cert-manager.io/v1",
		Kind:       "Issuer",
	}
	TypeMetaSecret = metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "Secret",
	}
	TypeMetaPodSecurityPolicy = metav1.TypeMeta{
		APIVersion: "policy/v1beta1",
		Kind:       "PodSecurityPolicy",
	}
	TypeMetaResourceQuota = metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "ResourceQuota",
	}
	TypeMetaBatchJob = metav1.TypeMeta{
		APIVersion: "batch/v1",
		Kind:       "Job",
	}
	TypeMetaBatchCronJob = metav1.TypeMeta{
		APIVersion: "batch/v1",
		Kind:       "CronJob",
	}
)

// validCookieChars contains all characters which may occur in an HTTP Cookie value (unicode \u0021 through \u007E),
// without the characters , ; and / ... I did not find more details about permissible characters in RFC2965, so I took
// this list of permissible chars from Wikipedia.
//
// The tokens we produce here (e.g. owner token or CLI API token) are likely placed in cookies or transmitted via HTTP.
// To make the lifes of downstream users easier we'll try and play nice here w.r.t. to the characters used.
var validCookieChars = []byte("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-.")

// RandomString produces a cryptographically secure random string of length N.
// The string contains alphanumeric characters and _ (underscore), - (dash) and . (dot)
func RandomString(length int) (string, error) {
	b := make([]byte, length)
	n, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	if n != length {
		return "", io.ErrShortWrite
	}

	lrsc := len(validCookieChars)
	for i, c := range b {
		b[i] = validCookieChars[int(c)%lrsc]
	}
	return string(b), nil
}

// ThirdPartyContainerRepo returns the container registry to use for third-party containers.
// If config registry is set to the Gitpod registry, the third-party registry is returned. If
// config registry is different, that repository is returned and deployment expected to mirror
// the images to their registry
func ThirdPartyContainerRepo(configRegistry string, thirdPartyRegistry string) string {
	configRegistry = strings.TrimSuffix(configRegistry, "/")

	if configRegistry == GitpodContainerRegistry {
		return thirdPartyRegistry
	}

	return configRegistry
}

// ToJSONString returns the serialized JSON string of an object
func ToJSONString(input interface{}) ([]byte, error) {
	return json.MarshalIndent(input, "", "  ")
}

func NodeNameEnv(context *RenderContext) []corev1.EnvVar {
	return []corev1.EnvVar{{
		Name: "NODENAME",
		ValueFrom: &corev1.EnvVarSource{
			FieldRef: &corev1.ObjectFieldSelector{FieldPath: "spec.nodeName"},
		},
	}}
}
