// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import "os"

// StorageConfig configures the remote storage we use
type StorageConfig struct {
	// Stage represents the deployment environment in which we're operating
	Stage Stage `json:"stage"`

	// Kind determines the type of storage we ought to use
	Kind RemoteStorageType `json:"kind"`

	// GCloudConfig configures the Google Bucket remote storage
	GCloudConfig GCPConfig `json:"gcloud"`

	// MinIOConfig configures the MinIO remote storage
	MinIOConfig MinIOConfig `json:"minio"`

	// BackupTrail maintains a number of backups for the same workspace
	BackupTrail struct {
		Enabled   bool `json:"enabled"`
		MaxLength int  `json:"maxLength"`
	} `json:"backupTrail"`

	BlobQuota int64 `json:"blobQuota"`
}

// Stage represents the deployment environment in which we're operating
type Stage string

const (
	// StageProduction is the live environment in which our users live
	StageProduction Stage = "prod"

	// StageStaging is our staging environment which runs very closely to production (hence the name)
	StageStaging Stage = "prodcopy"

	// StageDevStaging is our local or branch-built development environment
	StageDevStaging Stage = "dev"
)

// RemoteStorageType is a kind of storage where we persist/backup workspaces to
type RemoteStorageType string

const (
	// GCloudStorage stores workspaces in GCloud buckets
	GCloudStorage RemoteStorageType = "gcloud"

	// MinIOStorage stores workspaces in a MinIO/S3 storage
	MinIOStorage RemoteStorageType = "minio"

	// NullStorage does not synchronize workspaces at all
	NullStorage RemoteStorageType = ""
)

// GetStage reads the KUBE_STAGE envvar and maps its value to the storage stage naming
func getStageFromEnv() Stage {
	// the stage does not have to be explicitly set in the storage config (as that would duplicate the
	// info in our Helm values.yaml), but can be supplied as env var, as the default env vars in our
	// Helm charts do.
	stg := os.Getenv("KUBE_STAGE")
	switch stg {
	case "production":
		return StageProduction
	case "staging":
		return StageStaging
	default:
		return StageDevStaging
	}
}

// GetStage provides the storage stage from either this config or the environment
func (c *StorageConfig) GetStage() Stage {
	if c.Stage == "" {
		return getStageFromEnv()
	}

	return c.Stage
}

// GCPConfig controls the access to GCloud resources/buckets
type GCPConfig struct {
	CredentialsFile string `json:"credentialsFile"`
	Region          string `json:"region"`
	Project         string `json:"projectId"`
	ParallelUpload  int    `json:"parallelUpload"`

	MaximumBackupCount int `json:"maximumBackupCount"`
}

// MinIOConfig MinIOconfigures the MinIO remote storage backend
type MinIOConfig struct {
	Endpoint        string `json:"endpoint"`
	AccessKeyID     string `json:"accessKey"`
	SecretAccessKey string `json:"secretKey"`
	Secure          bool   `json:"secure,omitempty"`

	Region         string `json:"region"`
	ParallelUpload uint   `json:"parallelUpload,omitempty"`
}
