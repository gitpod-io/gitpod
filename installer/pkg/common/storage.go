// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"fmt"
	storageconfig "github.com/gitpod-io/gitpod/content-service/api/config"
	"k8s.io/utils/pointer"
	"path/filepath"

	corev1 "k8s.io/api/core/v1"
)

const storageMount = "/mnt/secrets/storage"

// StorageConfig produces config service configuration from the installer config

func useMinio(context *RenderContext) bool {
	// Minio is used for in-cluster storage and as a facade to non-GCP providers
	if pointer.BoolDeref(context.Config.ObjectStorage.InCluster, false) {
		return true
	}
	if context.Config.ObjectStorage.Azure != nil {
		return true
	}
	return false
}

func StorageConfig(context *RenderContext) storageconfig.StorageConfig {
	var res *storageconfig.StorageConfig
	if context.Config.ObjectStorage.CloudStorage != nil {
		res = &storageconfig.StorageConfig{
			Kind: storageconfig.GCloudStorage,
			GCloudConfig: storageconfig.GCPConfig{
				Region:             context.Config.Metadata.Region,
				Project:            context.Config.ObjectStorage.CloudStorage.Project,
				CredentialsFile:    filepath.Join(storageMount, "service-account.json"),
				ParallelUpload:     6,
				MaximumBackupCount: 3,
			},
		}
	}

	if context.Config.ObjectStorage.S3 != nil {
		res = &storageconfig.StorageConfig{
			Kind: storageconfig.MinIOStorage,
			MinIOConfig: storageconfig.MinIOConfig{
				Endpoint:            context.Config.ObjectStorage.S3.Endpoint,
				AccessKeyIdFile:     filepath.Join(storageMount, "accessKeyId"),
				SecretAccessKeyFile: filepath.Join(storageMount, "secretAccessKey"),
				Secure:              true,
				Region:              context.Config.Metadata.Region,
				ParallelUpload:      100,
			},
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

// mountStorage performs the actual storage mount, which is common across all providers
func mountStorage(pod *corev1.PodSpec, secret string, container ...string) {
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
				MountPath: storageMount,
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
		mountStorage(pod, ctx.Config.ObjectStorage.CloudStorage.ServiceAccount.Name, container...)

		return nil
	}

	if ctx.Config.ObjectStorage.S3 != nil {
		mountStorage(pod, ctx.Config.ObjectStorage.S3.Credentials.Name, container...)

		return nil
	}

	if useMinio(ctx) {
		// builtin storage needs no extra mounts
		return nil
	}

	return fmt.Errorf("no valid storage configuration set")
}
