// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"fmt"
	"io"
	"math/rand"
	"strings"

	storageconfig "github.com/gitpod-io/gitpod/content-service/api/config"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"

	"github.com/docker/distribution/reference"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"
)

// Valid characters for affinities are alphanumeric, -, _, . and one / as a subdomain prefix
const (
	AffinityLabelMeta               = "gitpod.io/workload_meta"
	AffinityLabelIDE                = "gitpod.io/workload_ide"
	AffinityLabelWorkspaceServices  = "gitpod.io/workload_workspace_services"
	AffinityLabelWorkspacesRegular  = "gitpod.io/workload_workspace_regular"
	AffinityLabelWorkspacesHeadless = "gitpod.io/workload_workspace_headless"
)

func DefaultLabels(component string) map[string]string {
	return map[string]string{
		"component": component,
	}
}

func MergeEnv(envs ...[]corev1.EnvVar) (res []corev1.EnvVar) {
	for _, e := range envs {
		res = append(res, e...)
	}
	return
}

func DefaultEnv(cfg *config.Config) []corev1.EnvVar {
	logLevel := "debug"
	if cfg.Observability.LogLevel != "" {
		logLevel = string(cfg.Observability.LogLevel)
	}

	return []corev1.EnvVar{
		{Name: "GITPOD_DOMAIN", Value: cfg.Domain},
		{Name: "LOG_LEVEL", Value: strings.ToLower(logLevel)},
	}
}

func TracingEnv(cfg *config.Config) (res []corev1.EnvVar) {
	if cfg.Observability.Tracing == nil {
		return
	}

	if cfg.Observability.Tracing.Endpoint != nil {
		res = append(res, corev1.EnvVar{Name: "JAEGER_ENDPOINT", Value: *cfg.Observability.Tracing.Endpoint})
	} else if cfg.Observability.Tracing.AgentHost != nil {
		res = append(res, corev1.EnvVar{Name: "JAEGER_AGENT_HOST", Value: *cfg.Observability.Tracing.Endpoint})
	} else {
		// TODO(cw): think about proper error handling here.
		//			 Returning an error would be the appropriate thing to do,
		//			 but would make env var composition more cumbersome.
	}

	res = append(res,
		corev1.EnvVar{Name: "JAEGER_SAMPLER_TYPE", Value: "const"},
		corev1.EnvVar{Name: "JAEGER_SAMPLER_PARAM", Value: "1"},
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

func MessageBusEnv(cfg *config.Config) (res []corev1.EnvVar) {
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
	var name string

	if *cfg.Database.InCluster {
		// Cluster provided internally
		name = InClusterDbSecret
	} else if cfg.Database.RDS.Certificate.Name != "" {
		// AWS
		name = cfg.Database.RDS.Certificate.Name
	} else if cfg.Database.CloudSQL.Certificate.Name != "" {
		// GCP
		name = cfg.Database.CloudSQL.Certificate.Name
	}

	obj := corev1.LocalObjectReference{Name: name}

	return []corev1.EnvVar{{
		Name: "DB_HOST",
		ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
			LocalObjectReference: obj,
			Key:                  "host",
		}},
	}, {
		Name: "DB_PORT",
		ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
			LocalObjectReference: obj,
			Key:                  "port",
		}},
	}, {
		Name: "DB_PASSWORD",
		ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
			LocalObjectReference: obj,
			Key:                  "password",
		}},
	}, {
		// todo(sje): conditional
		Name:  "DB_DELETED_ENTRIES_GC_ENABLED",
		Value: "false",
	}, {
		Name: "DB_ENCRYPTION_KEYS",
		// todo(sje): either Value or ValueFrom
		Value: "todo",
		//ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
		//	LocalObjectReference: corev1.LocalObjectReference{
		//		Name: "",
		//	},
		//	Key: "keys",
		//}},
	}}
}

func DatabaseWaiterContainer(ctx *RenderContext) *corev1.Container {
	return &corev1.Container{
		Name:  "database-waiter",
		Image: ImageName(ctx.Config.Repository, "service-waiter", "latest"),
		Args: []string{
			"-v",
			"database",
		},
		SecurityContext: &corev1.SecurityContext{
			Privileged: pointer.Bool(false),
			RunAsUser:  pointer.Int64(31001),
		},
		Env: MergeEnv(
			DatabaseEnv(&ctx.Config),
		),
	}
}

func MessageBusWaiterContainer(ctx *RenderContext) *corev1.Container {
	return &corev1.Container{
		Name:  "msgbus-waiter",
		Image: ImageName(ctx.Config.Repository, "service-waiter", "latest"),
		Args: []string{
			"-v",
			"messagebus",
		},
		SecurityContext: &corev1.SecurityContext{
			Privileged: pointer.Bool(false),
			RunAsUser:  pointer.Int64(31001),
		},
		Env: MergeEnv(
			MessageBusEnv(&ctx.Config),
		),
	}
}

func KubeRBACProxyContainer() *corev1.Container {
	return &corev1.Container{
		Name:  "kube-rbac-proxy",
		Image: "quay.io/brancz/kube-rbac-proxy:v0.9.0",
		Args: []string{
			"--v=10",
			"--logtostderr",
			"--insecure-listen-address=[$(IP)]:9500",
			"--upstream=http://127.0.0.1:9500/",
		},
		Ports: []corev1.ContainerPort{
			{Name: "metrics", ContainerPort: 9500},
		},
		Env: []corev1.EnvVar{
			{
				Name: "IP",
				ValueFrom: &corev1.EnvVarSource{
					FieldRef: &corev1.ObjectFieldSelector{
						FieldPath: "status.podIP",
					},
				},
			},
		},
		Resources: corev1.ResourceRequirements{Requests: corev1.ResourceList{
			corev1.ResourceName("cpu"):    resource.MustParse("1m"),
			corev1.ResourceName("memory"): resource.MustParse("30Mi"),
		}},
		TerminationMessagePolicy: corev1.TerminationMessagePolicy("FallbackToLogsOnError"),
		SecurityContext: &corev1.SecurityContext{
			RunAsUser:    pointer.Int64(65532),
			RunAsGroup:   pointer.Int64(65532),
			RunAsNonRoot: pointer.Bool(true),
		},
	}
}

func Affinity(orLabels ...string) *corev1.Affinity {
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

func ImageName(repo, name, tag string) string {
	ref := fmt.Sprintf("%s/%s:%s", strings.TrimSuffix(repo, "/"), name, tag)
	pref, err := reference.ParseNamed(ref)
	if err != nil {
		panic(fmt.Sprintf("cannot parse image ref %s: %v", ref, err))
	}
	if _, ok := pref.(reference.Tagged); !ok {
		panic(fmt.Sprintf("image ref %s has no tag: %v", ref, err))
	}

	return ref
}

func StorageConfig(cfg *config.Config) storageconfig.StorageConfig {
	var res *storageconfig.StorageConfig
	if cfg.ObjectStorage.CloudStorage != nil {
		// TODO(cw): where do we get the GCP project from? Is it even still needed?
		res = &storageconfig.StorageConfig{
			Kind: storageconfig.GCloudStorage,
			GCloudConfig: storageconfig.GCPConfig{
				Region:             cfg.Metadata.Region,
				Project:            "TODO",
				CredentialsFile:    "/mnt/secrets/gcp-storage/service-account.json",
				ParallelUpload:     6,
				MaximumBackupCount: 3,
			},
		}
	}
	if cfg.ObjectStorage.S3 != nil {
		// TODO(cw): where do we get the AWS secretKey and accessKey from?
		res = &storageconfig.StorageConfig{
			Kind: storageconfig.MinIOStorage,
			MinIOConfig: storageconfig.MinIOConfig{
				Endpoint:        "some-magic-amazon-value?",
				AccessKeyID:     "TODO",
				SecretAccessKey: "TODO",
				Secure:          true,
				Region:          cfg.Metadata.Region,
				ParallelUpload:  6,
			},
		}
	}
	if b := cfg.ObjectStorage.InCluster; b != nil && *b {
		res = &storageconfig.StorageConfig{
			Kind: storageconfig.MinIOStorage,
			MinIOConfig: storageconfig.MinIOConfig{
				Endpoint:        "minio",
				AccessKeyID:     "TODO",
				SecretAccessKey: "TODO",
				Secure:          true,
				Region:          cfg.Metadata.Region,
				ParallelUpload:  6,
			},
		}
	}

	if res == nil {
		panic("no valid storage configuration set")
	}

	// todo(sje): create exportable type
	res.BackupTrail = struct {
		Enabled   bool `json:"enabled"`
		MaxLength int  `json:"maxLength"`
	}{
		Enabled:   true,
		MaxLength: 3,
	}
	// 5 GiB
	res.BlobQuota = 5 * 1024 * 1024 * 1024

	return *res
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
				Port:     &intstr.IntOrString{IntVal: 9500},
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
	TypeMetaSecret = metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "Secret",
	}
	TypeMetaPodSecurityPolicy = metav1.TypeMeta{
		APIVersion: "policy/v1beta1",
		Kind:       "PodSecurityPolicy",
	}
)

type TLS struct {
	Authority   string `json:"ca"`
	Certificate string `json:"cert"`
	Key         string `json:"key"`
}

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
