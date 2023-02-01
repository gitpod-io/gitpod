// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	"fmt"

	"path/filepath"

	storageconfig "github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"k8s.io/utils/pointer"

	corev1 "k8s.io/api/core/v1"
)

const StorageMount = "/mnt/secrets/storage"

// StorageConfig produces config service configuration from the installer config

func useMinio(context *RenderContext) bool {
	// Minio is used for in-cluster storage and as a facade to non-GCP providers
	return pointer.BoolDeref(context.Config.ObjectStorage.InCluster, false)
}

func StorageConfig(context *RenderContext) storageconfig.StorageConfig {
	var res *storageconfig.StorageConfig
	if context.Config.ObjectStorage.CloudStorage != nil {
		res = &storageconfig.StorageConfig{
			Kind: storageconfig.GCloudStorage,
			GCloudConfig: storageconfig.GCPConfig{
				Region:          context.Config.Metadata.Region,
				Project:         context.Config.ObjectStorage.CloudStorage.Project,
				CredentialsFile: filepath.Join(StorageMount, "service-account.json"),
			},
		}
	}

	if context.Config.ObjectStorage.S3 != nil {
		res = &storageconfig.StorageConfig{
			Kind: storageconfig.S3Storage,
			S3Config: &storageconfig.S3Config{
				Region: context.Config.Metadata.Region,
				Bucket: context.Config.ObjectStorage.S3.BucketName,
			},
		}

		if context.Config.ObjectStorage.S3.Credentials != nil && context.Config.ObjectStorage.S3.Credentials.Kind != "" {
			res.S3Config.CredentialsFile = filepath.Join(StorageMount, "credentials")
		}
	}

	if useMinio(context) {
		res = &storageconfig.StorageConfig{
			Kind: storageconfig.MinIOStorage,
			MinIOConfig: storageconfig.MinIOConfig{
				Endpoint:        fmt.Sprintf("minio.%s.svc.cluster.local:%d", context.Namespace, MinioServiceAPIPort),
				AccessKeyID:     context.Values.StorageAccessKey,
				SecretAccessKey: context.Values.StorageSecretKey,
				Secure:          false,
				Region:          "local", // Local Minio requires this value - workspace allocation fails if not set to this
				ParallelUpload:  6,
			},
		}
	}

	if res == nil {
		panic("no valid storage configuration set")
	}

	// 5 GiB
	res.BlobQuota = 5 * 1024 * 1024 * 1024
	if context.Config.ObjectStorage.BlobQuota != nil {
		res.BlobQuota = *context.Config.ObjectStorage.BlobQuota
	}

	_ = context.WithExperimental(func(ucfg *experimental.Config) error {
		if ucfg.Workspace != nil {
			res.Stage = storageconfig.Stage(ucfg.Workspace.Stage)
		}
		return nil
	})

	return *res
}

// mountStorage performs the actual storage mount, which is common across all providers
func MountStorage(pod *corev1.PodSpec, secret string, container ...string) {
	volumeName := "storage-volume"

	pod.Volumes = append(pod.Volumes,
		corev1.Volume{
			Name: volumeName,
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: secret,
				},
			},
		},
	)

	idx := make(map[string]struct{}, len(container))
	if len(container) == 0 {
		for _, c := range pod.Containers {
			idx[c.Name] = struct{}{}
		}
	} else {
		for _, c := range container {
			idx[c] = struct{}{}
		}
	}

	for i := range pod.Containers {
		if _, ok := idx[pod.Containers[i].Name]; !ok {
			continue
		}

		pod.Containers[i].VolumeMounts = append(pod.Containers[i].VolumeMounts,
			corev1.VolumeMount{
				Name:      volumeName,
				ReadOnly:  true,
				MountPath: StorageMount,
			},
		)
	}
}

// AddStorageMounts adds mounts and volumes to a pod which are required for
// the storage configuration to function. If a list of containers is provided,
// the mounts are only added to those containers. If the list is empty, they're
// added to all containers.
func AddStorageMounts(ctx *RenderContext, pod *corev1.PodSpec, container ...string) error {
	if ctx.Config.ObjectStorage.CloudStorage != nil {
		MountStorage(pod, ctx.Config.ObjectStorage.CloudStorage.ServiceAccount.Name, container...)

		return nil
	}

	if ctx.Config.ObjectStorage.S3 != nil {
		if ctx.Config.ObjectStorage.S3.Credentials != nil {
			MountStorage(pod, ctx.Config.ObjectStorage.S3.Credentials.Name, container...)
		}

		return nil
	}

	if useMinio(ctx) {
		// builtin storage needs no extra mounts
		return nil
	}

	return fmt.Errorf("no valid storage configuration set")
}

func NewEmptyDirVolume(name string) *corev1.Volume {
	return &corev1.Volume{
		Name: name,
		VolumeSource: corev1.VolumeSource{
			EmptyDir: &corev1.EmptyDirVolumeSource{},
		},
	}
}
