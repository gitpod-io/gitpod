// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package storage

import (
	"context"
	"fmt"
	"hash/crc32"
	"io"
	"io/ioutil"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/opentracing/opentracing-go"

	gcpstorage "cloud.google.com/go/storage"
	validation "github.com/go-ozzo/ozzo-validation"
	"golang.org/x/oauth2/google"
	"golang.org/x/xerrors"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

var _ DirectAccess = &DirectGCPStorage{}

// GCPConfig controls the access to GCloud resources/buckets
type GCPConfig struct {
	CredentialsFile string `json:"credentialsFile"`
	Region          string `json:"region"`
	Project         string `json:"projectId"`
	ParallelUpload  int    `json:"parallelUpload"`

	// The maximum size a workspace can have before backup is disabled. 0 disables these checks.
	MaximumBackupSize  int64 `json:"maximumBackupSize"`
	MaximumBackupCount int   `json:"maximumBackupCount"`
}

var validateExistsInFilesystem = validation.By(func(o interface{}) error {
	s, ok := o.(string)
	if !ok {
		return xerrors.Errorf("field should be string")
	}

	if s == "" {
		// don't make this field required
		return nil
	}

	_, err := os.Stat(s)
	return err
})

// Validate checks if the GCloud storage GCPconfig is valid
func (c *GCPConfig) Validate() error {
	return validation.ValidateStruct(c,
		validation.Field(&c.CredentialsFile, validateExistsInFilesystem),
		validation.Field(&c.Region, validation.Required),
		validation.Field(&c.Project, validation.Required),
	)
}

// newDirectGCPAccess provides direct access to the remote storage system
func newDirectGCPAccess(cfg GCPConfig, stage Stage) (*DirectGCPStorage, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return &DirectGCPStorage{
		Stage:     stage,
		GCPConfig: cfg,
	}, nil
}

// DirectGCPStorage stores data in Google Cloud buckets, following a particular naming scheme
type DirectGCPStorage struct {
	Username      string
	WorkspaceName string
	GCPConfig     GCPConfig
	Stage         Stage

	client *gcpstorage.Client

	// ObjectAccess just exists so that we can swap out the stream access during testing
	ObjectAccess func(ctx context.Context, btk, obj string) (io.ReadCloser, bool, error)
}

// Validate checks if the GCloud storage is GCPconfigured properly
func (rs *DirectGCPStorage) Validate() error {
	err := rs.GCPConfig.Validate()
	if err != nil {
		return err
	}

	return validation.ValidateStruct(rs,
		validation.Field(&rs.Username, validation.Required),
		validation.Field(&rs.WorkspaceName, validation.Required),
		validation.Field(&rs.Stage, validation.Required),
	)
}

const (
	contentTypeTar = "application/x-tar"
)

// Init initializes the remote storage - call this before calling anything else on the interface
func (rs *DirectGCPStorage) Init(ctx context.Context, owner, workspace string) (err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "GCloudBucketRemotegcpStorage.Init")
	defer tracing.FinishSpan(span, &err)

	rs.Username = owner
	rs.WorkspaceName = workspace

	// now that we have all the information complete, validate if we're good to go
	err = rs.Validate()
	if err != nil {
		return xerrors.Errorf("invalid GCloud remote storage GCPconfig: %w", err)
	}

	client, err := newGCPClient(ctx, rs.GCPConfig)
	if err != nil {
		return err
	}
	rs.client = client

	if rs.ObjectAccess == nil {
		rs.ObjectAccess = rs.defaultObjectAccess
	}

	return nil
}

// EnsureExists makes sure that the remote storage location exists and can be up- or downloaded from
func (rs *DirectGCPStorage) EnsureExists(ctx context.Context) (err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "GCloudBucketRemotegcpStorage.EnsureExists")
	defer tracing.FinishSpan(span, &err)

	if rs.client == nil {
		return xerrors.Errorf("no gcloud client avialable - did you call Init()?")
	}

	hdl := rs.client.Bucket(rs.bucketName())
	_, err = hdl.Attrs(ctx)
	if err == nil {
		// bucket exists and everything is fine - we're done here
		return
	}
	if err != nil && err != gcpstorage.ErrBucketNotExist {
		return xerrors.Errorf("cannot ensure storage exists: %w", err)
	}

	log.WithField("bucketName", rs.bucketName()).Debug("Creating bucket")
	err = hdl.Create(ctx, rs.GCPConfig.Project, &gcpstorage.BucketAttrs{
		Location: rs.GCPConfig.Region,
	})
	if e, ok := err.(*googleapi.Error); ok && e.Code == http.StatusConflict && strings.Contains(strings.ToLower(e.Message), "you already own this bucket") {
		// Looks like we had a bucket creation race and lost.
		// That's ok - at least the bucket exists now and is still owned by us.
	} else if err != nil {
		return xerrors.Errorf("cannot create bucket: %w", err)
	}

	return nil
}

func (rs *DirectGCPStorage) defaultObjectAccess(ctx context.Context, bkt, obj string) (io.ReadCloser, bool, error) {
	if rs.client == nil {
		return nil, false, xerrors.Errorf("no gcloud client avialable - did you call Init()?")
	}

	hdl := rs.client.Bucket(bkt).Object(obj)
	rc, err := hdl.NewReader(ctx)
	if err != nil {
		return nil, false, err
	}

	return rc, false, nil
}

func (rs *DirectGCPStorage) download(ctx context.Context, destination string, bkt string, obj string) (found bool, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "download")
	span.SetTag("gcsBkt", bkt)
	span.SetTag("gcsObj", obj)
	defer tracing.FinishSpan(span, &err)

	rc, _, err := rs.ObjectAccess(ctx, bkt, obj)
	if rc == nil {
		return false, nil
	}
	defer rc.Close()

	err = extractTarbal(destination, rc)
	if err != nil {
		return true, err
	}

	if err := rs.fixLegacyFilenames(ctx, destination); err != nil {
		return true, err
	}

	return true, nil
}

/* tar files produced by the previous sync process contain their workspace ID in the filenames.
 * This behavior is difficult for snapshot backups, thus ws-daemond does not do that. However,
 * we need to be able to handle the "old" tar files, hence this legacy mode. See #1559.
 */
func (rs *DirectGCPStorage) fixLegacyFilenames(ctx context.Context, destination string) (err error) {
	//nolint:staticcheck,ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "fixLegacyFilenames")
	defer tracing.FinishSpan(span, &err)

	legacyPath := filepath.Join(destination, rs.WorkspaceName)
	if fi, err := os.Stat(legacyPath); os.IsNotExist(err) {
		// legacy path does not exist, nothing to do here
		return nil
	} else if fi.IsDir() {
		log.WithField("destination", destination).WithField("legacyPath", legacyPath).Info("Handling legacy backup")
		/* legacy path exists and is a directory - move it's content and remove the legacy path.
		 *
		 * Using mv here is difficult as the wildcard expansion is done by the shell and not mv,
		 * thus we'd need to wrap the mv call in a sh call -> too many dependencies to the outside world.
		 */
		fis, err := ioutil.ReadDir(legacyPath)
		if err != nil {
			return err
		}
		for _, fi := range fis {
			src := filepath.Join(legacyPath, fi.Name())
			dst := filepath.Join(destination, fi.Name())
			log.WithField("src", src).WithField("dst", dst).Debug("moving file")
			if err := os.Rename(src, dst); err != nil {
				return xerrors.Errorf("mv %s %s: %s", src, dst, err)
			}
		}

		if err := os.Remove(legacyPath); err != nil {
			return err
		}
	}

	return nil
}

// Download takes the latest state from the remote storage and downloads it to a local path
func (rs *DirectGCPStorage) Download(ctx context.Context, destination string, name string) (bool, error) {
	return rs.download(ctx, destination, rs.bucketName(), rs.objectName(name))
}

// DownloadSnapshot downloads a snapshot. The snapshot name is expected to be one produced by Qualify
func (rs *DirectGCPStorage) DownloadSnapshot(ctx context.Context, destination string, name string) (bool, error) {
	bkt, obj, err := ParseSnapshotName(name)
	if err != nil {
		return false, err
	}

	return rs.download(ctx, destination, bkt, obj)
}

// ParseSnapshotName parses the name of a snapshot into bucket and object
func ParseSnapshotName(name string) (bkt, obj string, err error) {
	segments := strings.Split(name, "@")
	if len(segments) != 2 {
		err = xerrors.Errorf("%s is not a valid GCloud remote storage FQN", name)
		return
	}

	obj = segments[0]
	bkt = segments[1]
	return
}

// Qualify fully qualifies a snapshot name so that it can be downloaded using DownloadSnapshot
func (rs *DirectGCPStorage) Qualify(name string) string {
	return fmt.Sprintf("%s@%s", rs.objectName(name), rs.bucketName())
}

// Upload takes all files from a local location and uploads it to the remote storage
func (rs *DirectGCPStorage) Upload(ctx context.Context, source string, name string, opts ...UploadOption) (bucket, object string, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "GCloudBucketRemotegcpStorage.Upload")
	defer tracing.FinishSpan(span, &err)
	log := log.WithFields(log.OWI(rs.Username, rs.WorkspaceName, ""))

	options, err := GetUploadOptions(opts)
	if err != nil {
		err = xerrors.Errorf("cannot get options: %w", err)
		return
	}

	if rs.client == nil {
		err = xerrors.Errorf("no gcloud client avialable - did you call Init()?")
		return
	}

	// check if we have not yet exceeded the max number of backups
	if name != DefaultBackup {
		if err = rs.ensureBackupSlotAvailable(); err != nil {
			return
		}
	}

	sfn, err := os.Open(source)
	if err != nil {
		err = xerrors.Errorf("cannot open file for uploading: %w", err)
		return
	}
	defer sfn.Close()

	var totalSize int64
	log.WithField("tasks", fmt.Sprintf("%d", rs.GCPConfig.ParallelUpload)).WithField("tmpfile", source).Debug("Uploading in parallel")
	stat, err := sfn.Stat()
	if err != nil {
		return
	}
	totalSize = stat.Size()
	span.SetTag("totalSize", totalSize)

	if rs.GCPConfig.MaximumBackupSize > 0 && totalSize > rs.GCPConfig.MaximumBackupSize {
		err = xerrors.Errorf("Workspace is too big and cannot be uploaded. Workspace size is %d bytes, max size is %d bytes", totalSize, rs.GCPConfig.MaximumBackupSize)
		return
	}

	uploadSpan := opentracing.StartSpan("remote-upload", opentracing.ChildOf(span.Context()))
	uploadSpan.SetTag("bucket", rs.bucketName())
	uploadSpan.SetTag("obj", rs.objectName(name))
	/* Read back from the file in chunks. We don't wand a complicated composition operation,
	 * so we'll have 32 chunks max. See https://cloud.google.com/storage/docs/composite-objects
	 * for more details.
	 */
	var chunks []string
	if chunks, err = rs.uploadChunks(opentracing.ContextWithSpan(ctx, uploadSpan), sfn, totalSize, rs.GCPConfig.ParallelUpload); err != nil {
		tracing.FinishSpan(uploadSpan, &err)
		return
	}
	defer func() {
		err := rs.deleteChunks(opentracing.ContextWithSpan(ctx, uploadSpan), chunks)
		if err != nil {
			log.WithError(err).WithField("name", name).Warn("cannot clean up upload chunks")
		}
	}()

	log.WithField("workspaceId", rs.WorkspaceName).WithField("bucketName", rs.bucketName()).Debug("Uploaded chunks")

	// compose the uploaded chunks
	bucket = rs.bucketName()
	bkt := rs.client.Bucket(bucket)
	src := make([]*gcpstorage.ObjectHandle, len(chunks))
	for i := 0; i < len(chunks); i++ {
		src[i] = bkt.Object(chunks[i])
	}
	object = rs.objectName(name)
	obj := bkt.Object(object)

	var firstBackup bool
	if _, e := obj.Attrs(ctx); e == gcpstorage.ErrObjectNotExist {
		firstBackup = true
	}
	// maintain backup trail if we're asked to - we do this prior to overwriting the regular backup file
	// to make sure we're trailign the previous backup.
	if options.BackupTrail.Enabled && !firstBackup {
		err := rs.trailBackup(ctx, bkt, obj, options.BackupTrail.ThisBackupID, options.BackupTrail.TrailLength)
		if err != nil {
			log.WithError(err).Error("cannot maintain backup trail")
		}
	}

	// now that the upload is complete and the backup trail has been created, compose the chunks to
	// create the actual backup
	_, err = obj.ComposerFrom(src...).Run(ctx)
	if err != nil {
		tracing.FinishSpan(uploadSpan, &err)
		return
	}
	attrs, err := obj.Update(ctx, gcpstorage.ObjectAttrsToUpdate{
		ContentType: options.ContentType,
		Metadata:    options.Annotations,
	})
	if err != nil {
		tracing.FinishSpan(uploadSpan, &err)
		return
	}
	log.WithField("chunkCount", fmt.Sprintf("%d", len(chunks))).Debug("Composited chunks")
	uploadSpan.Finish()

	// compare the MD5 sum of the composited object with the local tar file
	remotehash := attrs.CRC32C
	_, err = sfn.Seek(0, 0)
	if err != nil {
		log.WithError(err).Debug("cannot compute local checksum")

		// us being unable to produce the local checksum is not enough of a reason to fail the upload
		// altogether. We did upload something after all.
		err = nil
		return
	}
	var localhash uint32
	h := crc32.New(crc32.MakeTable(crc32.Castagnoli))
	_, err = io.Copy(h, sfn)
	if err != nil {
		log.WithError(err).Debug("cannot compute local checksum")
	} else {
		localhash = h.Sum32()
	}
	if remotehash == 0 || localhash == 0 {
		log.WithField("remotehash", remotehash).WithField("localhash", localhash).Debug("one of the checksums is empty - not comparing")
	} else if remotehash == localhash {
		log.WithField("remotehash", remotehash).WithField("localhash", localhash).Debug("checksums match")
	} else {
		log.WithField("remotehash", remotehash).WithField("localhash", localhash).Debug("checksums do not match")
	}

	err = nil
	return
}

func (rs *DirectGCPStorage) ensureBackupSlotAvailable() error {
	if rs.GCPConfig.MaximumBackupCount == 0 {
		// check is disabled
		return nil
	}
	if rs.client == nil {
		return xerrors.Errorf("no gcloud client avialable - did you call Init()?")
	}

	bkt := rs.client.Bucket(rs.bucketName())
	ctx := context.Background()
	objs := bkt.Objects(ctx, &gcpstorage.Query{Prefix: fmt.Sprintf("workspaces/%s", rs.WorkspaceName)})

	objcnt := 0
	for {
		_, err := objs.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return err
		}
		objcnt++
	}

	if objcnt > rs.GCPConfig.MaximumBackupCount {
		return xerrors.Errorf("Maximum number of snapshots (%d of %d) reached", objcnt, rs.GCPConfig.MaximumBackupCount)
	}

	return nil
}

func (rs *DirectGCPStorage) uploadChunks(ctx context.Context, f io.ReaderAt, totalSize int64, desiredChunkCount int) (chnks []string, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "uploadChunks")
	defer tracing.FinishSpan(span, &err)

	if totalSize == 0 {
		return []string{}, xerrors.Errorf("Total size must be greater than zero")
	}
	if desiredChunkCount < 1 {
		return []string{}, xerrors.Errorf("Desired chunk count must be greater (or equal to) one")
	}

	minChunkSize := int64(256 * 1024)
	chunkSize := totalSize / int64(desiredChunkCount)
	chunkSize = (chunkSize / minChunkSize) * minChunkSize
	if chunkSize < minChunkSize {
		chunkSize = minChunkSize
	}
	chunkCount := int(totalSize/chunkSize) + 1

	log.WithField("count", chunkCount).WithField("chunkSize", chunkSize).WithField("totalSize", totalSize).Debug("Computed chunk size")

	pfx := fmt.Sprintf("uploads/%s", randomString(20))

	// sync construct taken from https://play.golang.org/p/mqUvKFDQbfn
	errChannel := make(chan error, 1)
	chunks := make([]string, chunkCount)
	wg := sync.WaitGroup{}

	// we need to add ourselves to the working group here, and not in the
	// go routines, as they might start after the "finished" go routine.
	wg.Add(chunkCount)

	for i := 0; i < chunkCount; i++ {
		off := int64(i) * chunkSize
		n := chunkSize
		if off+n > totalSize {
			n = totalSize - off
		}
		r := io.NewSectionReader(f, off, n)
		chunkName := fmt.Sprintf("%s/%d-upload", pfx, i)
		chunks[i] = chunkName

		go rs.uploadChunk(opentracing.ContextWithSpan(ctx, span), chunkName, r, n, &wg, errChannel)
	}

	// Put the wait group in a go routine.
	// By putting the wait group in the go routine we ensure either all pass
	// and we close the "finished" channel or we wait forever for the wait group
	// to finish.
	//
	// Waiting forever is okay because of the blocking select below.
	finished := make(chan bool, 1)
	go func() {
		wg.Wait()
		close(finished)
	}()

	// This select will block until one of the two channels returns a value.
	// This means on the first failure in the go routines above the errChannel will release a
	// value first. Because there is a "return" statement in the err check this function will
	// exit when an error occurs.
	//
	// Due to the blocking on wg.Wait() the finished channel will not get a value unless all
	// the go routines before were successful because not all the wg.Done() calls would have
	// happened.
	select {
	case <-finished:
		log.Debug("Finished uploading")
	case err := <-errChannel:
		log.WithError(err).Debug("Error while uploading chunks")
		if err != nil {
			// already logged in uploadChunk
			return []string{}, err
		}
	}

	return chunks, nil
}

func (rs *DirectGCPStorage) uploadChunk(ctx context.Context, name string, r io.Reader, size int64, wg *sync.WaitGroup, errchan chan error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "uploadChunk")
	span.SetTag("size", size)
	defer span.Finish()

	defer wg.Done()

	start := time.Now()
	log.WithField("name", name).WithField("size", fmt.Sprintf("%d", size)).Debug("Uploading chunk")

	wc := rs.client.Bucket(rs.bucketName()).Object(name).NewWriter(ctx)
	defer wc.Close()

	written, err := io.Copy(wc, r)
	if err != nil {
		log.WithError(err).WithField("name", name).Error("Error while uploading chunk")
		errchan <- err
		return
	}
	if written != size {
		err := xerrors.Errorf("Wrote fewer bytes than it should have, %d instead of %d", written, size)
		log.WithError(err).WithField("name", name).Error("Error while uploading chunk")
		errchan <- err
		return
	}

	log.WithField("name", name).WithField("duration", time.Since(start)).Debug("Upload complete")
}

func (rs *DirectGCPStorage) deleteChunks(ctx context.Context, chunks []string) (err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "deleteChunks")
	defer tracing.FinishSpan(span, &err)

	for i := 0; i < len(chunks); i++ {
		err = rs.client.Bucket(rs.bucketName()).Object(chunks[i]).Delete(ctx)
	}

	if err != nil {
		log.WithError(err).Error("Error while deleting chunks")
		return err
	}

	return nil
}

func (rs *DirectGCPStorage) trailBackup(ctx context.Context, bkt *gcpstorage.BucketHandle, obj *gcpstorage.ObjectHandle, backupID string, trailLength int) (err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "uploadChunk")
	defer tracing.FinishSpan(span, &err)

	trailIter := bkt.Objects(ctx, &gcpstorage.Query{Prefix: rs.trailPrefix()})
	trailingObj := bkt.Object(rs.trailingObjectName(backupID, time.Now()))
	_, err = trailingObj.CopierFrom(obj).Run(ctx)
	if err != nil {
		return
	}
	span.LogKV("trailingBackupDone", trailingObj.ObjectName())
	log.WithField("obj", trailingObj.ObjectName()).Debug("trailing backup done")

	var (
		oldTrailObj *gcpstorage.ObjectAttrs
		trail       []string
	)
	for oldTrailObj, err = trailIter.Next(); oldTrailObj != nil; oldTrailObj, err = trailIter.Next() {
		trail = append(trail, oldTrailObj.Name)
	}
	if err != iterator.Done && err != nil {
		return
	}
	log.WithField("trailLength", len(trail)).Debug("listed backup trail")
	span.LogKV("trailLength", len(trail), "event", "listed backup trail")

	sort.Slice(trail, func(i, j int) bool { return trail[i] < trail[j] })

	for i, oldTrailObj := range trail {
		if i >= len(trail)-trailLength {
			break
		}

		err := bkt.Object(oldTrailObj).Delete(ctx)
		if err != nil {
			span.LogKV("event", "cannot delete trailing backup", "bkt", rs.bucketName(), "obj", oldTrailObj)
			log.WithError(err).WithField("obj", oldTrailObj).Warn("cannot delete old trailing backup")
			continue
		}
		span.LogKV("event", "old trailing object deleted", "bkt", rs.bucketName(), "obj", oldTrailObj)
		log.WithField("obj", oldTrailObj).WithField("originalTrailLength", len(trail)).Debug("old trailing object deleted")
	}
	return nil
}

func randomString(len int) string {
	min := 97
	max := 122
	bytes := make([]byte, len)
	for i := 0; i < len; i++ {
		bytes[i] = byte(min + rand.Intn(max-min))
	}
	return string(bytes)
}

func (rs *DirectGCPStorage) bucketName() string {
	return gcpBucketName(rs.Stage, rs.Username)
}

// Bucket provides the bucket name for a particular user
func (rs *DirectGCPStorage) Bucket(ownerID string) string {
	return gcpBucketName(rs.Stage, ownerID)
}

// BackupObject returns a backup's object name that a direct downloader would download
func (rs *DirectGCPStorage) BackupObject(name string) string {
	return rs.objectName(name)
}

func gcpBucketName(stage Stage, ownerID string) string {
	return fmt.Sprintf("gitpod-%s-user-%s", stage, ownerID)
}

func (rs *DirectGCPStorage) workspacePrefix() string {
	return fmt.Sprintf("workspaces/%s", rs.WorkspaceName)
}

func (rs *DirectGCPStorage) objectName(name string) string {
	return fmt.Sprintf("%s/%s", rs.workspacePrefix(), name)
}

func (rs *DirectGCPStorage) trailPrefix() string {
	return fmt.Sprintf("%s/trail-", rs.workspacePrefix())
}

func (rs *DirectGCPStorage) trailingObjectName(id string, t time.Time) string {
	return fmt.Sprintf("%s%d-%s", rs.trailPrefix(), t.Unix(), id)
}

func newGCPClient(ctx context.Context, cfg GCPConfig) (*gcpstorage.Client, error) {
	credfile := cfg.CredentialsFile
	if tproot := os.Getenv("TELEPRESENCE_ROOT"); tproot != "" {
		credfile = filepath.Join(tproot, credfile)
	}

	client, err := gcpstorage.NewClient(ctx, option.WithCredentialsFile(credfile))
	if err != nil {
		return nil, xerrors.Errorf("cannot create GCP storage client: %w", err)
	}
	return client, nil
}

func newPresignedGCPAccess(config GCPConfig, stage Stage) (*PresignedGCPStorage, error) {
	err := config.Validate()
	if err != nil {
		return nil, xerrors.Errorf("invalid config: %w", err)
	}

	credfile := config.CredentialsFile
	if tproot := os.Getenv("TELEPRESENCE_ROOT"); tproot != "" {
		credfile = filepath.Join(tproot, credfile)
	}

	jsonKey, err := ioutil.ReadFile(credfile)
	if err != nil {
		return nil, xerrors.Errorf("cannot read private key: %w", err)
	}
	privateKey, err := google.JWTConfigFromJSON(jsonKey)
	if err != nil {
		return nil, xerrors.Errorf("cannot get private key: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// We create a client here just to make sure that we can
	client, err := gcpstorage.NewClient(ctx, option.WithCredentialsFile(credfile))
	if err != nil {
		return nil, xerrors.Errorf("cannot create GCP storage client: %w", err)
	}
	client.Close()

	if err != nil {
		return nil, xerrors.Errorf("cannot get Google access ID: %w", err)
	}

	return &PresignedGCPStorage{
		config:     config,
		stage:      stage,
		privateKey: privateKey.PrivateKey,
		accessID:   privateKey.Email,
	}, nil
}

// PresignedGCPStorage provides presigned URLs to access GCP storage objects
type PresignedGCPStorage struct {
	config     GCPConfig
	stage      Stage
	privateKey []byte
	accessID   string
}

// Bucket provides the bucket name for a particular user
func (p *PresignedGCPStorage) Bucket(owner string) string {
	return gcpBucketName(p.stage, owner)
}

// SignDownload provides presigned URLs to access remote storage objects
func (p *PresignedGCPStorage) SignDownload(ctx context.Context, bucket, object string) (*DownloadInfo, error) {
	client, err := newGCPClient(ctx, p.config)
	if err != nil {
		return nil, err
	}
	defer client.Close()

	bkt := client.Bucket(bucket)
	_, err = bkt.Attrs(ctx)
	if err == gcpstorage.ErrBucketNotExist {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	obj := bkt.Object(object)
	attrs, err := obj.Attrs(ctx)
	if err == gcpstorage.ErrObjectNotExist {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	res, err := p.downloadInfo(ctx, client, attrs)
	if err != nil {
		return nil, err
	}

	return res, nil
}

func (p *PresignedGCPStorage) downloadInfo(ctx context.Context, client *gcpstorage.Client, obj *gcpstorage.ObjectAttrs) (*DownloadInfo, error) {
	meta := &ObjectMeta{
		ContentType:        obj.ContentType,
		OCIMediaType:       obj.Metadata[ObjectAnnotationOCIContentType],
		Digest:             obj.Metadata[ObjectAnnotationDigest],
		UncompressedDigest: obj.Metadata[ObjectAnnotationUncompressedDigest],
	}
	url, err := gcpstorage.SignedURL(obj.Bucket, obj.Name, &gcpstorage.SignedURLOptions{
		Method:         "GET",
		GoogleAccessID: p.accessID,
		PrivateKey:     p.privateKey,
		Expires:        time.Now().Add(30 * time.Minute),
	})
	if err != nil {
		return nil, err
	}

	return &DownloadInfo{
		Meta: *meta,
		URL:  url,
		Size: obj.Size,
	}, nil
}
