// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package storage

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	validation "github.com/go-ozzo/ozzo-validation"
	minio "github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	config "github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
)

var _ DirectAccess = &DirectMinIOStorage{}

// Validate checks if the GCloud storage MinIOconfig is valid
func ValidateMinIOConfig(c *config.MinIOConfig) error {
	return validation.ValidateStruct(c,
		validation.Field(&c.Endpoint, validation.Required),
		validation.Field(&c.AccessKeyID, validation.Required),
		validation.Field(&c.SecretAccessKey, validation.Required),
		validation.Field(&c.Region, validation.Required),
	)
}

// MinIOClient produces a new minio client based on this configuration
func NewMinIOClient(c *config.MinIOConfig) (*minio.Client, error) {
	if c.ParallelUpload == 0 {
		c.ParallelUpload = 1
	}

	// now that we have all the information complete, validate if we're good to go
	err := ValidateMinIOConfig(c)
	if err != nil {
		return nil, err
	}

	minioClient, err := minio.New(c.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(c.AccessKeyID, c.SecretAccessKey, ""),
		Secure: c.Secure,
	})
	if err != nil {
		return nil, err
	}

	return minioClient, nil
}

// newDirectMinIOAccess provides direct access to the remote storage system
func newDirectMinIOAccess(cfg config.MinIOConfig) (*DirectMinIOStorage, error) {
	if err := ValidateMinIOConfig(&cfg); err != nil {
		return nil, err
	}
	return &DirectMinIOStorage{MinIOConfig: cfg}, nil
}

// DirectMinIOStorage implements MinIO as remote storage backend
type DirectMinIOStorage struct {
	Username      string
	WorkspaceName string
	InstanceID    string
	MinIOConfig   config.MinIOConfig

	client *minio.Client

	// ObjectAccess just exists so that we can swap out the stream access during testing
	ObjectAccess func(ctx context.Context, btk, obj string) (io.ReadCloser, error)
}

// Validate checks if the GCloud storage is MinIOconfigured properly
func (rs *DirectMinIOStorage) Validate() error {
	err := ValidateMinIOConfig(&rs.MinIOConfig)
	if err != nil {
		return err
	}

	return validation.ValidateStruct(rs,
		validation.Field(&rs.Username, validation.Required),
		validation.Field(&rs.WorkspaceName, validation.Required),
	)
}

// Init initializes the remote storage - call this before calling anything else on the interface
func (rs *DirectMinIOStorage) Init(ctx context.Context, owner, workspace, instance string) (err error) {
	rs.Username = owner
	rs.WorkspaceName = workspace
	rs.InstanceID = instance
	err = rs.Validate()
	if err != nil {
		return err
	}

	cl, err := NewMinIOClient(&rs.MinIOConfig)
	if err != nil {
		return err
	}
	rs.client = cl

	if rs.ObjectAccess == nil {
		rs.ObjectAccess = rs.defaultObjectAccess
	}

	return nil
}

func (rs *DirectMinIOStorage) defaultObjectAccess(ctx context.Context, bkt, obj string) (io.ReadCloser, error) {
	if rs.client == nil {
		return nil, xerrors.Errorf("no MinIO client available - did you call Init()?")
	}

	object, err := rs.client.GetObject(ctx, bkt, obj, minio.GetObjectOptions{})
	if err != nil {
		return nil, translateMinioError(err)
	}
	_, err = object.Stat()
	if err != nil {
		return nil, translateMinioError(err)
	}

	return object, nil
}

// EnsureExists makes sure that the remote storage location exists and can be up- or downloaded from
func (rs *DirectMinIOStorage) EnsureExists(ctx context.Context) (err error) {
	return minioEnsureExists(ctx, rs.client, rs.bucketName(), rs.MinIOConfig)
}

func minioEnsureExists(ctx context.Context, client *minio.Client, bucketName string, miniIOConfig config.MinIOConfig) (err error) {
	//nolint:staticcheck,ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "DirectEnsureExists")
	defer tracing.FinishSpan(span, &err)

	if client == nil {
		return xerrors.Errorf("no MinIO client available - did you call Init()?")
	}

	exists, err := client.BucketExists(ctx, bucketName)
	if err != nil {
		return err
	}
	if exists {
		// bucket exists already - we're fine
		return nil
	}

	log.WithField("bucketName", bucketName).Debug("Creating bucket")
	err = client.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{Region: miniIOConfig.Region})
	if err != nil {
		return xerrors.Errorf("cannot create bucket: %w", err)
	}

	return nil
}

func (rs *DirectMinIOStorage) download(ctx context.Context, destination string, bkt string, obj string, mappings []archive.IDMapping) (found bool, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "download")
	span.SetTag("bucket", bkt)
	span.SetTag("object", obj)
	defer tracing.FinishSpan(span, &err)

	rc, err := rs.ObjectAccess(ctx, bkt, obj)
	if rc == nil {
		return false, nil
	}
	defer rc.Close()

	err = extractTarbal(ctx, destination, rc, mappings)
	if err != nil {
		return true, err
	}

	return true, nil
}

// Download takes the latest state from the remote storage and downloads it to a local path
func (rs *DirectMinIOStorage) Download(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (bool, error) {
	return rs.download(ctx, destination, rs.bucketName(), rs.objectName(name), mappings)
}

// DownloadSnapshot downloads a snapshot. The snapshot name is expected to be one produced by Qualify
func (rs *DirectMinIOStorage) DownloadSnapshot(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (bool, error) {
	bkt, obj, err := ParseSnapshotName(name)
	if err != nil {
		return false, err
	}

	return rs.download(ctx, destination, bkt, obj, mappings)
}

// ListObjects returns all objects found with the given prefix. Returns an empty list if the bucket does not exuist (yet).
func (rs *DirectMinIOStorage) ListObjects(ctx context.Context, prefix string) (objects []string, err error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	bucketName := rs.bucketName()
	exists, err := rs.client.BucketExists(ctx, bucketName)
	if err != nil {
		return nil, xerrors.Errorf("cannot list objects: %w", err)
	}
	if !exists {
		// bucket does not exist: nothing to list
		return nil, nil
	}

	objectCh := rs.client.ListObjects(ctx, bucketName, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})
	for object := range objectCh {
		if object.Err != nil {
			return nil, xerrors.Errorf("cannot iterate list objects: %w", object.Err)
		}
		objects = append(objects, object.Key)
	}
	return objects, nil
}

// Qualify fully qualifies a snapshot name so that it can be downloaded using DownloadSnapshot
func (rs *DirectMinIOStorage) Qualify(name string) string {
	return fmt.Sprintf("%s@%s", rs.objectName(name), rs.bucketName())
}

// UploadInstance takes all files from a local location and uploads it to the per-instance remote storage
func (rs *DirectMinIOStorage) UploadInstance(ctx context.Context, source string, name string, opts ...UploadOption) (bucket, object string, err error) {
	if rs.InstanceID == "" {
		return "", "", xerrors.Errorf("instanceID is required to comput object name")
	}
	return rs.Upload(ctx, source, InstanceObjectName(rs.InstanceID, name), opts...)
}

// Upload takes all files from a local location and uploads it to the remote storage
func (rs *DirectMinIOStorage) Upload(ctx context.Context, source string, name string, opts ...UploadOption) (bucket, obj string, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "DirectUpload")
	defer tracing.FinishSpan(span, &err)

	options, err := GetUploadOptions(opts)
	if err != nil {
		err = xerrors.Errorf("cannot get options: %w", err)
		return
	}

	if rs.client == nil {
		err = xerrors.Errorf("no minio client available - did you call Init()?")
		return
	}

	// upload the thing
	bucket = rs.bucketName()
	obj = rs.objectName(name)
	span.LogKV("bucket", bucket)
	span.LogKV("obj", obj)
	span.LogKV("endpoint", rs.MinIOConfig.Endpoint)
	span.LogKV("region", rs.MinIOConfig.Region)
	span.LogKV("key", rs.MinIOConfig.AccessKeyID)
	_, err = rs.client.FPutObject(ctx, bucket, obj, source, minio.PutObjectOptions{
		NumThreads:   rs.MinIOConfig.ParallelUpload,
		UserMetadata: options.Annotations,
		ContentType:  options.ContentType,
	})
	if err != nil {
		return
	}

	return
}

func minioBucketName(ownerID string) string {
	return fmt.Sprintf("gitpod-user-%s", ownerID)
}

func minioWorkspaceBackupObjectName(workspaceID string, name string) string {
	return fmt.Sprintf("workspaces/%s/%s", workspaceID, name)
}

// Bucket provides the bucket name for a particular user
func (rs *DirectMinIOStorage) Bucket(ownerID string) string {
	return minioBucketName(ownerID)
}

// BackupObject returns a backup's object name that a direct downloader would download
func (rs *DirectMinIOStorage) BackupObject(name string) string {
	return rs.objectName(name)
}

func (rs *DirectMinIOStorage) bucketName() string {
	return minioBucketName(rs.Username)
}

func (rs *DirectMinIOStorage) objectName(name string) string {
	return minioWorkspaceBackupObjectName(rs.WorkspaceName, name)
}

func newPresignedMinIOAccess(cfg config.MinIOConfig) (*presignedMinIOStorage, error) {
	cl, err := NewMinIOClient(&cfg)
	if err != nil {
		return nil, err
	}
	return &presignedMinIOStorage{client: cl, MinIOConfig: cfg}, nil
}

type presignedMinIOStorage struct {
	client      *minio.Client
	MinIOConfig config.MinIOConfig
}

// EnsureExists makes sure that the remote storage location exists and can be up- or downloaded from
func (s *presignedMinIOStorage) EnsureExists(ctx context.Context, bucket string) (err error) {
	return minioEnsureExists(ctx, s.client, bucket, s.MinIOConfig)
}

func (s *presignedMinIOStorage) DiskUsage(ctx context.Context, bucket string, prefix string) (size int64, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "minio.DiskUsage")
	defer tracing.FinishSpan(span, &err)

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	objectCh := s.client.ListObjects(ctx, bucket, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})
	var total int64
	for object := range objectCh {
		if object.Err != nil {
			return 0, object.Err
		}
		total += object.Size
	}
	return total, nil
}

func (s *presignedMinIOStorage) SignDownload(ctx context.Context, bucket, object string, options *SignedURLOptions) (info *DownloadInfo, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "minio.SignDownload")
	defer func() {
		if err == ErrNotFound {
			span.LogKV("found", false)
			tracing.FinishSpan(span, nil)
			return
		}

		tracing.FinishSpan(span, &err)
	}()

	obj, err := s.client.GetObject(ctx, bucket, object, minio.GetObjectOptions{})
	if err != nil {
		return nil, translateMinioError(err)
	}
	stat, err := obj.Stat()
	if err != nil {
		return nil, translateMinioError(err)
	}
	url, err := s.client.PresignedGetObject(ctx, bucket, object, 30*time.Minute, nil)
	if err != nil {
		return nil, translateMinioError(err)
	}

	return &DownloadInfo{
		Meta: ObjectMeta{
			ContentType:        stat.ContentType,
			OCIMediaType:       stat.Metadata.Get(annotationToAmzMetaHeader(ObjectAnnotationOCIContentType)),
			Digest:             stat.Metadata.Get(annotationToAmzMetaHeader(ObjectAnnotationDigest)),
			UncompressedDigest: stat.Metadata.Get(annotationToAmzMetaHeader(ObjectAnnotationUncompressedDigest)),
		},
		Size: stat.Size,
		URL:  url.String(),
	}, nil
}

// SignUpload describes an object for upload
func (s *presignedMinIOStorage) SignUpload(ctx context.Context, bucket, obj string, options *SignedURLOptions) (info *UploadInfo, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "minio.SignUpload")
	defer func() {
		if err == ErrNotFound {
			span.LogKV("found", false)
			tracing.FinishSpan(span, nil)
			return
		}

		tracing.FinishSpan(span, &err)
	}()

	url, err := s.client.PresignedPutObject(ctx, bucket, obj, 30*time.Minute)
	if err != nil {
		return nil, translateMinioError(err)
	}
	return &UploadInfo{URL: url.String()}, nil
}

func (s *presignedMinIOStorage) DeleteObject(ctx context.Context, bucket string, query *DeleteObjectQuery) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "minio.DeleteObject")
	defer tracing.FinishSpan(span, &err)

	if query.Name != "" {
		err = s.client.RemoveObject(ctx, bucket, query.Name, minio.RemoveObjectOptions{})
		if err != nil {
			log.WithField("bucket", bucket).WithField("object", query.Name).Error(err)
			return translateMinioError(err)
		}
		return nil
	}
	if query.Prefix != "" {
		objectsCh := make(chan minio.ObjectInfo)
		go func() {
			defer close(objectsCh)
			for object := range s.client.ListObjects(ctx, bucket, minio.ListObjectsOptions{
				Prefix:    query.Prefix,
				Recursive: true,
			}) {
				objectsCh <- object
			}
		}()
		for removeErr := range s.client.RemoveObjects(ctx, bucket, objectsCh, minio.RemoveObjectsOptions{}) {
			err = removeErr.Err
			log.WithField("bucket", bucket).WithField("object", removeErr.ObjectName).Error(err)
		}
	}
	return translateMinioError(err)
}

// DeleteBucket deletes a bucket
func (s *presignedMinIOStorage) DeleteBucket(ctx context.Context, bucket string) (err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "minio.DeleteBucket")
	defer tracing.FinishSpan(span, &err)

	err = s.DeleteObject(ctx, bucket, &DeleteObjectQuery{Prefix: "/"})
	if err != nil {
		return translateMinioError(err)
	}

	err = s.client.RemoveBucket(ctx, bucket)
	if err != nil {
		return translateMinioError(err)
	}
	return nil
}

// ObjectHash gets a hash value of an object
func (s *presignedMinIOStorage) ObjectHash(ctx context.Context, bucket string, obj string) (hash string, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "minio.ObjectHash")
	defer tracing.FinishSpan(span, &err)

	info, err := s.client.StatObject(ctx, bucket, obj, minio.StatObjectOptions{})
	if err != nil {
		return "", translateMinioError(err)
	}
	return info.ETag, nil
}

func (s *presignedMinIOStorage) ObjectExists(ctx context.Context, bucket, obj string) (exists bool, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "minio.ObjectExists")
	defer tracing.FinishSpan(span, &err)

	_, err = s.client.StatObject(ctx, bucket, obj, minio.StatObjectOptions{})
	if err != nil {
		e := translateMinioError(err)
		if e == ErrNotFound {
			return false, nil
		}
		return false, e
	}
	return true, nil
}

func annotationToAmzMetaHeader(annotation string) string {
	return http.CanonicalHeaderKey(fmt.Sprintf("X-Amz-Meta-%s", annotation))
}

// Bucket provides the bucket name for a particular user
func (s *presignedMinIOStorage) Bucket(ownerID string) string {
	return minioBucketName(ownerID)
}

// BlobObject returns a blob's object name
func (s *presignedMinIOStorage) BlobObject(name string) (string, error) {
	return blobObjectName(name)
}

// BackupObject returns a backup's object name that a direct downloader would download
func (s *presignedMinIOStorage) BackupObject(workspaceID string, name string) string {
	return minioWorkspaceBackupObjectName(workspaceID, name)
}

// InstanceObject returns a instance's object name that a direct downloader would download
func (s *presignedMinIOStorage) InstanceObject(workspaceID string, instanceID string, name string) string {
	return s.BackupObject(workspaceID, InstanceObjectName(instanceID, name))
}

func translateMinioError(err error) error {
	if err == nil {
		return nil
	}

	aerr, ok := err.(*minio.ErrorResponse)
	if ok {
		if aerr.StatusCode == http.StatusNotFound || aerr.Code == "NoSuchKey" || aerr.Code == "NoSuchBucket" {
			return ErrNotFound
		}
	}

	if strings.Contains(err.Error(), "bucket does not exist") {
		return ErrNotFound
	}
	if strings.Contains(err.Error(), "key does not exist") {
		return ErrNotFound
	}

	return err
}
