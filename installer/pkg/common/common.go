// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"fmt"
	"strings"

	"github.com/docker/distribution/reference"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/pointer"
)

const (
	AffinityLabelMeta              = "gitpod.io/workload_meta"
	AffinityLabelWorkspaceServices = "gitpod.io/workload_workspace_services"
	AffinityLabelWorkspaces        = "gitpod.io/workload_workspaces"
	AffinityLabelHeadless          = "gitpod.io/workload_headless"
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
					Operator: corev1.NodeSelectorOperator("Exists"),
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

func StorageConfig(cfg *config.Config) storage.Config {
	var res *storage.Config
	if cfg.ObjectStorage.CloudStorage != nil {
		// TODO(cw): where do we get the GCP project from? Is it even still needed?
		res = &storage.Config{
			Kind: storage.GCloudStorage,
			GCloudConfig: storage.GCPConfig{
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
		res = &storage.Config{
			Kind: storage.MinIOStorage,
			MinIOConfig: storage.MinIOConfig{
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
		res = &storage.Config{
			Kind: storage.MinIOStorage,
			MinIOConfig: storage.MinIOConfig{
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

	res.BackupTrail = storage.BackupTrailConfig{
		Enabled:   true,
		MaxLength: 3,
	}
	// 5 GiB
	res.BlobQuota = 5 * 1024 * 1024 * 1024

	return *res
}

// TODO(cw): find a better way to do this. Those values must exist in the appropriate places already.
var (
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
	TypeMetaNetworkPolicy = metav1.TypeMeta{
		APIVersion: "networking.k8s.io/v1",
		Kind:       "NetworkPolicy",
	}
	TypeMetaDeployment = metav1.TypeMeta{
		APIVersion: "apps/v1",
		Kind:       "Deployment",
	}
)
