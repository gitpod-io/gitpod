// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package blobserve

import (
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"time"

	"github.com/containerd/containerd/errdefs"
	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/xerrors"
)

type blobspace interface {
	Get(name string) (fs http.FileSystem, state blobstate)
	AddFromTarGzip(ctx context.Context, name string, in io.Reader) (err error)
}

type diskBlobspace struct {
	Location string
	MaxSize  int64
}

func newBlobSpace(loc string, maxSize int64, housekeepingInterval time.Duration) (bs *diskBlobspace, err error) {
	if tproot := os.Getenv("TELEPRESENCE_ROOT"); tproot != "" {
		loc = filepath.Join(tproot, loc)
	}

	err = os.MkdirAll(loc, 0755)
	if err != nil {
		return
	}

	bs = &diskBlobspace{
		Location: loc,
		MaxSize:  maxSize,
	}
	if maxSize > 0 {
		go bs.collectGarbage(housekeepingInterval)
	}
	return
}

type blobstate int

const (
	blobUnknown blobstate = iota
	blobUnready
	blobReady
)

const (
	minBlobAge = 20 * time.Minute
)

func (b *diskBlobspace) collectGarbage(interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()

	for {
		log.Debug("starting blobspace GC")
		var (
			blobs     []gcBlob
			totalSize int64
		)

		files, err := ioutil.ReadDir(b.Location)
		if err != nil {
			log.WithError(err).WithField("location", b.Location).Error("blobspace cannot list files in working area")
		}

		for _, f := range files {
			if !f.IsDir() {
				continue
			}

			blob := getGCBlob(b.Location, f)
			if blob.Size == 0 && time.Since(blob.LastUsed) > minBlobAge {
				// this blob has neither been used nor ready for long enough
				// let's remove it

				// TODO: also remove this blob if we're not aware of it being initialized at the moment
				log.WithField("location", blob.F).Info("removing too old unready blob")

				err = os.RemoveAll(blob.F)
				if err != nil {
					log.WithError(err).WithField("location", blob.F).Error("cannot remove blob")
				}
				continue
			}

			blobs = append(blobs, blob)
			totalSize += blob.Size
		}

		var spaceFreed int64
		if totalSize > b.MaxSize {
			// oldest first
			sort.Slice(blobs, func(i, j int) bool { return blobs[j].LastUsed.After(blobs[i].LastUsed) })

			for totalSize > b.MaxSize && len(blobs) > 0 {
				blob := blobs[0]
				blobs = blobs[1:]

				log.WithField("location", blob.F).WithField("lastUsed", blob.LastUsed.Format(time.RFC3339Nano)).Info("removing old blob to make some space")

				os.Remove(fmt.Sprintf("%s.ready", blob.F))
				os.Remove(fmt.Sprintf("%s.size", blob.F))
				os.Remove(fmt.Sprintf("%s.used", blob.F))
				err = os.RemoveAll(blob.F)
				if err != nil {
					log.WithError(err).WithField("location", blob.F).Error("cannot remove blob")
					continue
				}
				totalSize -= blob.Size
				spaceFreed += blob.Size
			}
		}
		log.WithField("spaceFreed", spaceFreed).Info("blobspace GC complete")

		<-t.C
	}
}

type gcBlob struct {
	F        string
	LastUsed time.Time
	Size     int64
}

func getGCBlob(wd string, f os.FileInfo) (blob gcBlob) {
	fn := filepath.Join(wd, f.Name())
	blob = gcBlob{
		F:        fn,
		LastUsed: f.ModTime(),
		Size:     0,
	}
	if _, err := os.Stat(fmt.Sprintf("%s.ready", fn)); os.IsNotExist(err) {
		return
	}

	if rawSize, err := ioutil.ReadFile(fmt.Sprintf("%s.size", fn)); err == nil {
		if size, err := strconv.ParseInt(string(rawSize), 10, 64); err == nil {
			blob.Size = size
		}
	}

	if stat, err := os.Stat(fmt.Sprintf("%s.used", fn)); err == nil {
		blob.LastUsed = stat.ModTime()
	}

	return
}

func (b *diskBlobspace) Get(name string) (fs http.FileSystem, state blobstate) {
	fn := filepath.Join(b.Location, name)
	if _, err := os.Stat(fn); os.IsNotExist(err) {
		return nil, blobUnknown
	}
	if _, err := os.Stat(fmt.Sprintf("%s.ready", fn)); os.IsNotExist(err) {
		return nil, blobUnready
	}

	ioutil.WriteFile(fmt.Sprintf("%s.used", fn), nil, 0644)
	return http.Dir(fn), blobReady
}

// AddFromTar adds content to this store under the given name.
// In is expected to yield an uncompressed tar stream.
func (b *diskBlobspace) AddFromTar(ctx context.Context, name string, in io.Reader) (err error) {
	fn := filepath.Join(b.Location, name)
	if _, err := os.Stat(fn); !os.IsNotExist(err) {
		return errdefs.ErrAlreadyExists
	}

	err = os.MkdirAll(fn, 0755)
	if err != nil {
		return err
	}

	var cw countingWriter
	cin := io.TeeReader(in, &cw)

	cmd := exec.Command("tar", "x")
	cmd.Dir = fn
	cmd.Stdin = cin
	go func() {
		<-ctx.Done()
		cmd.Process.Kill()
	}()

	out, err := cmd.CombinedOutput()
	if err != nil {
		return xerrors.Errorf("cannot untar: %w: %s", err, string(out))
	}

	ioutil.WriteFile(fmt.Sprintf("%s.size", fn), []byte(fmt.Sprintf("%d", cw.C)), 0644)
	ioutil.WriteFile(fmt.Sprintf("%s.used", fn), nil, 0644)
	ioutil.WriteFile(fmt.Sprintf("%s.ready", fn), nil, 0644)

	return nil
}

// AddFromTarGzip adds content to this store under the given name.
// In is expected to yield a gzip compressed tar stream.
func (b *diskBlobspace) AddFromTarGzip(ctx context.Context, name string, in io.Reader) (err error) {
	gin, err := gzip.NewReader(in)
	if err != nil {
		return err
	}

	return b.AddFromTar(ctx, name, gin)
}

type countingWriter struct {
	C int64
}

func (c *countingWriter) Write(b []byte) (int, error) {
	c.C += int64(len(b))
	return len(b), nil
}
