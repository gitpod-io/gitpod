// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package storage

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"golang.org/x/xerrors"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	s3manager "github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

const (
	defaultCopyConcurrency = 10
	defaultPartSize        = 50 // MiB
	megabytes              = 1024 * 1024
)

var _ DirectAccess = &s3Storage{}
var _ PresignedAccess = &PresignedS3Storage{}

type S3Config struct {
	Bucket string
}

type S3Client interface {
	ListObjectsV2(ctx context.Context, params *s3.ListObjectsV2Input, optFns ...func(*s3.Options)) (*s3.ListObjectsV2Output, error)
	DeleteObjects(ctx context.Context, params *s3.DeleteObjectsInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectsOutput, error)
	GetObjectAttributes(ctx context.Context, params *s3.GetObjectAttributesInput, optFns ...func(*s3.Options)) (*s3.GetObjectAttributesOutput, error)
	GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error)
}

type PresignedS3Client interface {
	PresignGetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error)
	PresignPutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error)
}

func NewPresignedS3Access(client S3Client, config S3Config) *PresignedS3Storage {
	return &PresignedS3Storage{
		Config: config,
		client: client,
		PresignedFactory: func() PresignedS3Client {
			if s3c, ok := client.(*s3.Client); ok {
				return s3.NewPresignClient(s3c)
			}
			return nil
		},
	}
}

type PresignedS3Storage struct {
	Config S3Config

	client S3Client

	// PresignedFactory exists for testing only. DO NOT USE in production.
	PresignedFactory func() PresignedS3Client
}

// Bucket implements PresignedAccess
func (rs *PresignedS3Storage) Bucket(userID string) string {
	return rs.Config.Bucket
}

// BlobObject implements PresignedAccess
func (rs *PresignedS3Storage) BlobObject(userID, name string) (string, error) {
	blb, err := blobObjectName(name)
	if err != nil {
		return "", err
	}

	return filepath.Join(userID, blb), nil
}

// BackupObject implements PresignedAccess
func (rs *PresignedS3Storage) BackupObject(ownerID string, workspaceID string, name string) string {
	return s3WorkspaceBackupObjectName(ownerID, workspaceID, name)
}

// DeleteBucket implements PresignedAccess
func (rs *PresignedS3Storage) DeleteBucket(ctx context.Context, userID, bucket string) error {
	if bucket != rs.Config.Bucket {
		log.WithField("requestedBucket", bucket).WithField("configuredBucket", rs.Config.Bucket).Error("can only delete from configured bucket")
		return xerrors.Errorf("can only delete from configured bucket; this looks like a bug in Gitpod")
	}

	return rs.DeleteObject(ctx, rs.Config.Bucket, &DeleteObjectQuery{Prefix: userID + "/"})
}

// DeleteObject implements PresignedAccess
func (rs *PresignedS3Storage) DeleteObject(ctx context.Context, bucket string, query *DeleteObjectQuery) error {
	var objects []types.ObjectIdentifier

	switch {
	case query.Name != "":
		objects = []types.ObjectIdentifier{{Key: &query.Name}}

	case query.Prefix != "":
		resp, err := rs.client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
			Bucket: aws.String(rs.Config.Bucket),
			Prefix: aws.String(query.Prefix),
		})
		if err != nil {
			return err
		}
		for _, e := range resp.Contents {
			objects = append(objects, types.ObjectIdentifier{
				Key: e.Key,
			})
		}
	}

	if len(objects) == 0 {
		return nil
	}

	_, err := rs.client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
		Bucket: &rs.Config.Bucket,
		Delete: &types.Delete{
			Objects: objects,
			Quiet:   true,
		},
	})
	if err != nil {
		return err
	}

	return nil
}

// DiskUsage implements PresignedAccess
func (rs *PresignedS3Storage) DiskUsage(ctx context.Context, bucket string, prefix string) (size int64, err error) {
	resp, err := rs.client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket: &rs.Config.Bucket,
		Prefix: aws.String(prefix),
	})
	if err != nil {
		return 0, err
	}

	for _, r := range resp.Contents {
		size += int64(r.Size)
	}
	return
}

// EnsureExists implements PresignedAccess
func (rs *PresignedS3Storage) EnsureExists(ctx context.Context, bucket string) error {
	return nil
}

// InstanceObject implements PresignedAccess
func (rs *PresignedS3Storage) InstanceObject(ownerID string, workspaceID string, instanceID string, name string) string {
	return rs.BackupObject(ownerID, workspaceID, InstanceObjectName(instanceID, name))
}

// ObjectExists implements PresignedAccess
func (rs *PresignedS3Storage) ObjectExists(ctx context.Context, bucket string, path string) (bool, error) {
	_, err := rs.client.GetObjectAttributes(ctx, &s3.GetObjectAttributesInput{
		Bucket:           &rs.Config.Bucket,
		Key:              aws.String(path),
		ObjectAttributes: []types.ObjectAttributes{types.ObjectAttributesEtag},
	})

	var nsk *types.NoSuchKey
	if errors.As(err, &nsk) {
		return false, nil
	}

	if err != nil {
		return false, err
	}
	return true, nil
}

// ObjectHash implements PresignedAccess
func (rs *PresignedS3Storage) ObjectHash(ctx context.Context, bucket string, obj string) (string, error) {
	resp, err := rs.client.GetObjectAttributes(ctx, &s3.GetObjectAttributesInput{
		Bucket:           &rs.Config.Bucket,
		Key:              aws.String(obj),
		ObjectAttributes: []types.ObjectAttributes{types.ObjectAttributesEtag},
	})
	var nsk *types.NoSuchKey
	if errors.As(err, &nsk) {
		return "", ErrNotFound
	}

	if err != nil {
		return "", err
	}

	return *resp.ETag, nil
}

// SignDownload implements PresignedAccess
func (rs *PresignedS3Storage) SignDownload(ctx context.Context, bucket string, obj string, options *SignedURLOptions) (info *DownloadInfo, err error) {
	resp, err := rs.client.GetObjectAttributes(ctx, &s3.GetObjectAttributesInput{
		Bucket:           &rs.Config.Bucket,
		Key:              aws.String(obj),
		ObjectAttributes: []types.ObjectAttributes{types.ObjectAttributesObjectSize},
	})

	var nsk *types.NoSuchKey
	if errors.As(err, &nsk) {
		return nil, ErrNotFound
	}

	if err != nil {
		return nil, err
	}

	req, err := rs.PresignedFactory().PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(rs.Config.Bucket),
		Key:    aws.String(obj),
	})
	if err != nil {
		return nil, err
	}

	return &DownloadInfo{
		Meta: ObjectMeta{
			// TODO(cw): implement this if we need to support FWB with S3
		},
		Size: resp.ObjectSize,
		URL:  req.URL,
	}, nil
}

// SignUpload implements PresignedAccess
func (rs *PresignedS3Storage) SignUpload(ctx context.Context, bucket string, obj string, options *SignedURLOptions) (info *UploadInfo, err error) {
	resp, err := rs.PresignedFactory().PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket: &rs.Config.Bucket,
		Key:    aws.String(obj),
	})
	if err != nil {
		return nil, err
	}

	return &UploadInfo{
		URL: resp.URL,
	}, nil
}

func newDirectS3Access(client S3Client, config S3Config) *s3Storage {
	return &s3Storage{
		Config: config,
		client: client,
	}
}

type s3Storage struct {
	Config S3Config

	OwnerID, WorkspaceID, InstanceID string

	client S3Client
}

// Bucket implements DirectAccess
func (s3st *s3Storage) Bucket(userID string) string {
	return s3st.Config.Bucket
}

// BackupObject implements DirectAccess
func (s3st *s3Storage) BackupObject(name string) string {
	return s3st.objectName(name)
}

// Download implements DirectAccess
func (s3st *s3Storage) Download(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (found bool, err error) {
	return s3st.download(ctx, destination, s3st.objectName(name), mappings)
}

// DownloadSnapshot implements DirectAccess
func (s3st *s3Storage) DownloadSnapshot(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (found bool, err error) {
	return s3st.download(ctx, destination, name, mappings)
}

// download object using s5cmd (prior to which we used aws sdk)
func (s3st *s3Storage) download(ctx context.Context, destination string, obj string, mappings []archive.IDMapping) (found bool, err error) {
	tempFile, err := os.CreateTemp("", "temporal-s3-file")
	if err != nil {
		return true, xerrors.Errorf("creating temporal file: %s", err.Error())
	}
	tempFile.Close()

	args := []string{
		"cp",
		// # of file parts to download at once
		"--concurrency", "20",
		// size in MB of each part
		"--part-size", "25",
		destination,
		tempFile.Name(),
	}
	cmd := exec.Command("s5cmd", args...)
	downloadStart := time.Now()
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.WithError(err).WithField("out", string(out)).Error("unexpected error downloading file")
		return false, xerrors.Errorf("unexpected error downloading file")
	}
	downloadDuration := time.Since(downloadStart)
	log.WithField("downloadDuration", downloadDuration.String()).Info("S3 download duration")

	tempFile, err = os.Open(tempFile.Name())
	if err != nil {
		return true, xerrors.Errorf("unexpected error opening downloaded file")
	}

	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	extractStart := time.Now()
	err = archive.ExtractTarbal(ctx, tempFile, destination, archive.WithUIDMapping(mappings), archive.WithGIDMapping(mappings))
	if err != nil {
		return true, xerrors.Errorf("tar %s: %s", destination, err.Error())
	}
	extractDuration := time.Since(extractStart)
	log.WithField("extractdDuration", extractDuration.String()).Info("tarbar extraction duration")

	return true, nil
}

// EnsureExists implements DirectAccess
func (*s3Storage) EnsureExists(ctx context.Context) error {
	return nil
}

// Init implements DirectAccess
func (s3st *s3Storage) Init(ctx context.Context, owner string, workspace string, instance string) error {
	s3st.OwnerID = owner
	s3st.WorkspaceID = workspace
	s3st.InstanceID = instance
	return nil
}

// ListObjects implements DirectAccess
func (s3st *s3Storage) ListObjects(ctx context.Context, prefix string) ([]string, error) {
	if !strings.HasPrefix(prefix, s3st.OwnerID+"/") {
		return nil, xerrors.Errorf("prefix must start with the owner ID")
	}

	var res []string
	listParams := &s3.ListObjectsV2Input{
		Bucket: aws.String(s3st.Config.Bucket),
		Prefix: aws.String(prefix),
	}
	fetchObjects := true
	for fetchObjects {
		objs, err := s3st.client.ListObjectsV2(ctx, listParams)

		if err != nil {
			return nil, xerrors.Errorf("cannot list objects: %w", err)
		}

		for _, o := range objs.Contents {
			res = append(res, *o.Key)
		}

		listParams.ContinuationToken = objs.NextContinuationToken
		fetchObjects = objs.IsTruncated
	}

	return res, nil
}

// Qualify implements DirectAccess
func (s3st *s3Storage) Qualify(name string) string {
	return fmt.Sprintf("%s@%s", s3st.objectName(name), s3st.Config.Bucket)
}

func (s3st *s3Storage) objectName(name string) string {
	return s3WorkspaceBackupObjectName(s3st.OwnerID, s3st.WorkspaceID, name)
}

func s3WorkspaceBackupObjectName(ownerID, workspaceID, name string) string {
	return filepath.Join(ownerID, "workspaces", workspaceID, name)
}

// Upload implements DirectAccess
func (s3st *s3Storage) Upload(ctx context.Context, source string, name string, opts ...UploadOption) (bucket string, obj string, err error) {
	options, err := GetUploadOptions(opts)
	if err != nil {
		err = xerrors.Errorf("cannot get options: %w", err)
		return
	}

	if s3st.client == nil {
		err = xerrors.Errorf("no s3 client available - did you call Init()?")
		return
	}

	f, err := os.Open(source)
	if err != nil {
		err = xerrors.Errorf("cannot read backup file: %w", err)
	}
	defer f.Close()

	var contentType *string
	if options.ContentType != "" {
		contentType = aws.String(options.ContentType)
	}

	bucket = s3st.Config.Bucket
	obj = s3st.objectName(name)

	s3c, ok := s3st.client.(*s3.Client)
	if !ok {
		err = xerrors.Errorf("Can only upload with actual S3 client")
	}

	uploader := s3manager.NewUploader(s3c, func(u *s3manager.Uploader) {
		u.Concurrency = defaultCopyConcurrency
		u.PartSize = defaultPartSize * megabytes
		u.BufferProvider = s3manager.NewBufferedReadSeekerWriteToPool(25 * megabytes)
	})
	_, err = uploader.Upload(ctx, &s3.PutObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(obj),

		// f implements io.ReadSeeker and hence is uploaded in parallel.
		// cf. https://aws.github.io/aws-sdk-go-v2/docs/sdk-utilities/s3/#putobjectinput-body-field-ioreadseeker-vs-ioreader
		Body: f,

		Metadata:    options.Annotations,
		ContentType: contentType,
	})
	if err != nil {
		return
	}

	return
}

// UploadInstance implements DirectAccess
func (s3st *s3Storage) UploadInstance(ctx context.Context, source string, name string, opts ...UploadOption) (bucket string, obj string, err error) {
	if s3st.InstanceID == "" {
		return "", "", xerrors.Errorf("instanceID is required to comput object name")
	}
	return s3st.Upload(ctx, source, InstanceObjectName(s3st.InstanceID, name), opts...)
}
