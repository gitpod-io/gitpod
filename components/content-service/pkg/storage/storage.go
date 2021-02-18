// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"regexp"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"golang.org/x/xerrors"
)

const (
	// DefaultBackup is the name of the regular backup we upload to remote storage
	DefaultBackup = "full.tar"

	// DefaultBackupManifest is the name of the manifest of the regular default backup we upload
	DefaultBackupManifest = "wsfull.json"

	// FmtFullWorkspaceBackup is the format for names of full workspace backups
	FmtFullWorkspaceBackup = "wsfull-%d.tar"
)

var (
	// ErrNotFound is returned when an object is not found
	ErrNotFound = fmt.Errorf("not found")
)

// BucketNamer provides names for storage buckets
type BucketNamer interface {
	// Bucket provides the bucket name for a particular user
	Bucket(userID string) string
}

// BackupObjectNamer provides names for storage objects
type BackupObjectNamer interface {
	// BackupObject returns a backup's object name that a direct downloader would download
	BackupObject(name string) string
}

type BlobObjectNamer interface {
	// BlobObject returns a blob's object name
	BlobObject(name string) (string, error)
}

// PresignedAccess provides presigned URLs to access remote storage objects
type PresignedAccess interface {
	BucketNamer
	BlobObjectNamer

	// EnsureExists makes sure that the remote storage location exists and can be up- or downloaded from
	EnsureExists(ctx context.Context, ownerId string) error

	// DiskUsage gives the total objects size of objects that have the given prefix
	DiskUsage(ctx context.Context, bucket string, prefix string) (size int64, err error)

	// SignDownload describes an object for download - if the object is not found, ErrNotFound is returned
	SignDownload(ctx context.Context, bucket, obj string) (info *DownloadInfo, err error)

	// SignUpload describes an object for upload
	SignUpload(ctx context.Context, bucket, obj string) (info *UploadInfo, err error)

	// DeleteObject deletes objects in the given bucket specified by the given query
	DeleteObject(ctx context.Context, bucket string, query *DeleteObjectQuery) error
}

// ObjectMeta describtes the metadata of a remote object
type ObjectMeta struct {
	ContentType        string
	OCIMediaType       string
	Digest             string
	UncompressedDigest string
}

// DownloadInfo describes an object for download
type DownloadInfo struct {
	Meta ObjectMeta
	URL  string
	Size int64
}

// UploadInfo describes an object for upload
type UploadInfo struct {
	URL string
}

// DeleteObjectQuery specifies objects to delete, either by an exact name or prefix
type DeleteObjectQuery struct {
	Prefix string
	Name   string
}

// DirectDownloader downloads a snapshot
type DirectDownloader interface {
	// Download takes the latest state from the remote storage and downloads it to a local path
	Download(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (found bool, err error)

	// Downloads a snapshot. The snapshot name is expected to be one produced by Qualify
	DownloadSnapshot(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (found bool, err error)
}

// DirectAccess represents a remote location where we can store data
type DirectAccess interface {
	BucketNamer
	BackupObjectNamer
	DirectDownloader

	// Init initializes the remote storage - call this before calling anything else on the interface
	Init(ctx context.Context, owner, workspace string) error

	// EnsureExists makes sure that the remote storage location exists and can be up- or downloaded from
	EnsureExists(ctx context.Context) error

	// Fully qualifies a snapshot name so that it can be downloaded using DownloadSnapshot
	Qualify(name string) string

	// Upload takes all files from a local location and uploads it to the remote storage
	Upload(ctx context.Context, source string, name string, options ...UploadOption) (bucket, obj string, err error)
}

// UploadOptions configure remote storage upload
type UploadOptions struct {
	BackupTrail struct {
		Enabled      bool
		ThisBackupID string
		TrailLength  int
	}

	// Annotations are generic metadata atteched to a storage object
	Annotations map[string]string

	ContentType string
}

// UploadOption configures a particular aspect of remote storage upload
type UploadOption func(*UploadOptions) error

// WithBackupTrail enables backup trailing for this upload
func WithBackupTrail(thisBackupID string, trailLength int) UploadOption {
	return func(opts *UploadOptions) error {
		if thisBackupID == "" {
			return xerrors.Errorf("backup ID is missing")
		}
		if trailLength < 1 {
			return xerrors.Errorf("backup trail length must be greater zero")
		}

		opts.BackupTrail.Enabled = true
		opts.BackupTrail.ThisBackupID = thisBackupID
		opts.BackupTrail.TrailLength = trailLength

		return nil
	}
}

// WithAnnotations adds arbitrary metadata to a storage object
func WithAnnotations(md map[string]string) UploadOption {
	return func(opts *UploadOptions) error {
		opts.Annotations = md
		return nil
	}
}

// WithContentType sets the content mime type of the object
func WithContentType(ct string) UploadOption {
	return func(opts *UploadOptions) error {
		opts.ContentType = ct
		return nil
	}
}

// GetUploadOptions turns functional opts into a struct
func GetUploadOptions(opts []UploadOption) (*UploadOptions, error) {
	res := &UploadOptions{}
	for _, o := range opts {
		err := o(res)
		if err != nil {
			return nil, err
		}
	}
	return res, nil
}

const (
	// ObjectAnnotationDigest is the digest of actual object
	ObjectAnnotationDigest = "gitpod-digest"

	// ObjectAnnotationUncompressedDigest is the digest of the uncompressed object, if the object is compressed
	ObjectAnnotationUncompressedDigest = "gitpod-uncompressedDigest"

	// ObjectAnnotationOCIContentType is the OCI media type of the object
	ObjectAnnotationOCIContentType = "gitpod-oci-contentType"
)

// Config configures the remote storage we use
type Config struct {
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
func (c *Config) GetStage() Stage {
	if c.Stage == "" {
		return getStageFromEnv()
	}

	return c.Stage
}

// NewDirectAccess provides direct access to a storage system
func NewDirectAccess(c *Config) (DirectAccess, error) {
	stage := c.GetStage()
	if stage == "" {
		return nil, xerrors.Errorf("missing storage stage")
	}

	switch c.Kind {
	case GCloudStorage:
		return newDirectGCPAccess(c.GCloudConfig, stage)
	case MinIOStorage:
		return newDirectMinIOAccess(c.MinIOConfig)
	default:
		return &DirectNoopStorage{}, nil
	}
}

// NewPresignedAccess provides presigned URLs to access a storage system
func NewPresignedAccess(c *Config) (PresignedAccess, error) {
	stage := c.GetStage()
	if stage == "" {
		return nil, xerrors.Errorf("missing storage stage")
	}

	switch c.Kind {
	case GCloudStorage:
		return newPresignedGCPAccess(c.GCloudConfig, stage)
	case MinIOStorage:
		return newPresignedMinIOAccess(c.MinIOConfig)
	default:
		log.Warnf("falling back to noop presigned storage access. Is this intentional? (storage kind: %s)", c.Kind)
		return &PresignedNoopStorage{}, nil
	}
}

func extractTarbal(ctx context.Context, dest string, src io.Reader, mappings []archive.IDMapping) error {
	err := archive.ExtractTarbal(ctx, src, dest, archive.WithUIDMapping(mappings), archive.WithGIDMapping(mappings))
	if err != nil {
		return xerrors.Errorf("tar %s: %s", dest, err.Error())
	}

	return nil
}

func blobObjectName(name string) (string, error) {
	blobRegex := `^[a-zA-Z0-9._\-\/]+$`
	b, err := regexp.MatchString(blobRegex, name)
	if err != nil {
		return "", err
	}
	if !b {
		return "", xerrors.Errorf("blob name '%s' needs to match regex '%s'", name, blobRegex)
	}
	return fmt.Sprintf("blobs/%s", name), nil
}
