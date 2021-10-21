// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:generate ./generate-mock.sh

package storage

import (
	"context"
	"fmt"
	"io"
	"regexp"

	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	config "github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
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
	ErrNotFound = xerrors.Errorf("not found")
)

// BucketNamer provides names for storage buckets
type BucketNamer interface {
	// Bucket provides the bucket name for a particular user
	Bucket(userID string) string
}

// BackupObjectNamer provides names for workspace backup objects
type BackupObjectNamer interface {
	// BackupObject returns a backup's object name that a direct downloader would download
	BackupObject(name string) string
}

// InstanceObjectNamer provides names for objects per workspace instance
type InstanceObjectNamer interface {
	// InstanceObject returns a instance's object name that a direct downloader would download
	InstanceObject(name string) string
}

// BlobObjectNamer provides names for blob objects
type BlobObjectNamer interface {
	// BlobObject returns a blob's object name
	BlobObject(name string) (string, error)
}

// PresignedAccess provides presigned URLs to access remote storage objects
type PresignedAccess interface {
	BucketNamer
	BlobObjectNamer

	// EnsureExists makes sure that the remote storage location exists and can be up- or downloaded from
	EnsureExists(ctx context.Context, bucket string) error

	// DiskUsage gives the total objects size of objects that have the given prefix
	DiskUsage(ctx context.Context, bucket string, prefix string) (size int64, err error)

	// SignDownload describes an object for download - if the object is not found, ErrNotFound is returned
	SignDownload(ctx context.Context, bucket, obj string, options *SignedURLOptions) (info *DownloadInfo, err error)

	// SignUpload describes an object for upload
	SignUpload(ctx context.Context, bucket, obj string, options *SignedURLOptions) (info *UploadInfo, err error)

	// DeleteObject deletes objects in the given bucket specified by the given query
	DeleteObject(ctx context.Context, bucket string, query *DeleteObjectQuery) error

	// DeleteBucket deletes a bucket
	DeleteBucket(ctx context.Context, bucket string) error

	// ObjectHash gets a hash value of an object
	ObjectHash(ctx context.Context, bucket string, obj string) (string, error)

	// ObjectExists tells whether the given object exists or not
	ObjectExists(ctx context.Context, bucket string, path string) (bool, error)

	// BackupObject returns a backup's object name that a direct downloader would download
	BackupObject(workspaceID string, name string) string

	// InstanceObject returns a instance's object name that a direct downloader would download
	InstanceObject(workspaceID string, instanceID string, name string) string
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

// SignedURLOptions allows you to restrict the access to the signed URL.
type SignedURLOptions struct {
	// ContentType is the content type header the client must provide
	// to use the generated signed URL.
	// Optional.
	ContentType string
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
	Init(ctx context.Context, owner, workspace, instance string) error

	// EnsureExists makes sure that the remote storage location exists and can be up- or downloaded from
	EnsureExists(ctx context.Context) error

	// ListObjects returns all objects found with the given prefix. Returns an empty list if the bucket does not exuist (yet).
	ListObjects(ctx context.Context, prefix string) ([]string, error)

	// Fully qualifies a snapshot name so that it can be downloaded using DownloadSnapshot
	Qualify(name string) string

	// Upload takes all files from a local location and uploads it to the remote storage
	Upload(ctx context.Context, source string, name string, options ...UploadOption) (bucket, obj string, err error)

	// UploadInstance takes all files from a local location and uploads it to the remote storage
	UploadInstance(ctx context.Context, source string, name string, options ...UploadOption) (bucket, obj string, err error)
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

// NewDirectAccess provides direct access to a storage system
func NewDirectAccess(c *config.StorageConfig) (DirectAccess, error) {
	stage := c.GetStage()
	if stage == "" {
		return nil, xerrors.Errorf("missing storage stage")
	}

	switch c.Kind {
	case config.GCloudStorage:
		return newDirectGCPAccess(c.GCloudConfig, stage)
	case config.MinIOStorage:
		return newDirectMinIOAccess(c.MinIOConfig)
	default:
		return &DirectNoopStorage{}, nil
	}
}

// NewPresignedAccess provides presigned URLs to access a storage system
func NewPresignedAccess(c *config.StorageConfig) (PresignedAccess, error) {
	stage := c.GetStage()
	if stage == "" {
		return nil, xerrors.Errorf("missing storage stage")
	}

	switch c.Kind {
	case config.GCloudStorage:
		return newPresignedGCPAccess(c.GCloudConfig, stage)
	case config.MinIOStorage:
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

func InstanceObjectName(instanceID, name string) string {
	return fmt.Sprintf("instances/%s/%s", instanceID, name)
}
