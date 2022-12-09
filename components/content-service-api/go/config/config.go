// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"os"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
)

// StorageConfig configures the remote storage we use
type StorageConfig struct {
	// Stage represents the deployment environment in which we're operating
	Stage Stage `json:"stage"`

	// Kind determines the type of storage we ought to use
	Kind RemoteStorageType `json:"kind"`

	// GCloudConfig configures the Google Bucket remote storage
	GCloudConfig GCPConfig `json:"gcloud,omitempty"`

	// MinIOConfig configures the MinIO remote storage
	MinIOConfig MinIOConfig `json:"minio,omitempty"`

	// S3Config configures the S3 remote storage
	S3Config *S3Config `json:"s3,omitempty"`

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

	// S3Storage stores workspaces in a S3 storage. It assumes the AWS-typical credentials
	// exist in the environment. See https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/config#LoadDefaultConfig for more details.
	S3Storage RemoteStorageType = "s3"

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
}

// MinIOConfig MinIOconfigures the MinIO remote storage backend
type MinIOConfig struct {
	Endpoint            string `json:"endpoint"`
	AccessKeyID         string `json:"accessKey"`
	AccessKeyIdFile     string `json:"accessKeyFile"`
	SecretAccessKey     string `json:"secretKey"`
	SecretAccessKeyFile string `json:"secretKeyFile"`
	Secure              bool   `json:"secure,omitempty"`

	Region         string `json:"region"`
	ParallelUpload uint   `json:"parallelUpload,omitempty"`

	BucketName string `json:"bucket,omitempty"`
}

// S3Config configures the S3 remote storage backend
type S3Config struct {
	Bucket          string `json:"bucket"`
	Region          string `json:"region"`
	CredentialsFile string `json:"credentialsFile"`
}

type PProf struct {
	Addr string `json:"address"`
}

// UsageReportConfig configures the upload of workspace instance usage reports
type UsageReportConfig struct {
	BucketName string `json:"bucketName"`
}

type ServiceConfig struct {
	Service baseserver.ServerConfiguration `json:"service"`
	Storage StorageConfig                  `json:"storage"`
	// Deprecated
	_ UsageReportConfig `json:"usageReport"`
}
