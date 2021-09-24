//
// Copyright 2013-2018 Docker, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// gitpod.io uses a subset of the features and requires
// a custom handling of tar header fields Uname and Gname
package content

import (
	"archive/tar"
	"bufio"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/docker/docker/pkg/archive"
	"github.com/docker/docker/pkg/idtools"
	"github.com/docker/docker/pkg/pools"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// TarOptions wraps the tar options.
type TarOptions struct {
	UIDMaps []idtools.IDMap
	GIDMaps []idtools.IDMap
}

// tarWithOptions creates an archive from the directory at `path`
func TarWithOptions(srcPath string, options *TarOptions) (io.ReadCloser, error) {
	pipeReader, pipeWriter := io.Pipe()

	p := pools.BufioWriter32KPool
	buf := p.Get(pipeWriter)
	compressWriter := p.NewWriteCloserWrapper(buf, buf)

	go func() {
		ta := newTarAppender(
			idtools.NewIDMappingsFromMaps(options.UIDMaps, options.GIDMaps),
			compressWriter,
		)

		defer func() {
			// Make sure to check the error on Close.
			if err := ta.TarWriter.Close(); err != nil {
				log.Errorf("Can't close tar writer: %s", err)
			}
			if err := compressWriter.Close(); err != nil {
				log.Errorf("Can't close compress writer: %s", err)
			}
			if err := pipeWriter.Close(); err != nil {
				log.Errorf("Can't close pipe writer: %s", err)
			}
		}()

		// this buffer is needed for the duration of this piped stream
		defer pools.BufioWriter32KPool.Put(ta.Buffer)

		_ = filepath.WalkDir(srcPath, func(filePath string, f os.DirEntry, err error) error {
			if err != nil {
				log.Errorf("Tar: Can't stat file %s to tar: %s", srcPath, err)
				return nil
			}

			relFilePath, err := filepath.Rel(srcPath, filePath)
			if err != nil || (relFilePath == "." && f.IsDir()) {
				// Error getting relative path OR we are looking
				// at the source directory path. Skip in both situations.
				return nil
			}

			if relFilePath == "." {
				return nil
			}

			if err := ta.addTarFile(filePath, filepath.Join(".", relFilePath)); err != nil {
				log.Errorf("Can't add file %s to tar: %s", filePath, err)
				// if pipe is broken, stop writing tar stream to it
				if err == io.ErrClosedPipe {
					return err
				}
			}
			return nil
		})
	}()

	return pipeReader, nil
}

// whiteoutPrefix prefix means file is a whiteout. If this is followed by a
// filename this means that file has been removed from the base layer.
const whiteoutPrefix = ".wh."

type tarAppender struct {
	TarWriter *tar.Writer
	Buffer    *bufio.Writer

	// for hardlink mapping
	SeenFiles       map[uint64]string
	IdentityMapping *idtools.IdentityMapping
}

func newTarAppender(idMapping *idtools.IdentityMapping, writer io.Writer) *tarAppender {
	return &tarAppender{
		SeenFiles:       make(map[uint64]string),
		TarWriter:       tar.NewWriter(writer),
		Buffer:          pools.BufioWriter32KPool.Get(nil),
		IdentityMapping: idMapping,
	}
}

// addTarFile adds to the tar archive a file from `path` as `name`
func (ta *tarAppender) addTarFile(path, name string) error {
	fi, err := os.Lstat(path)
	if err != nil {
		return err
	}

	var link string
	if fi.Mode()&os.ModeSymlink != 0 {
		var err error
		link, err = os.Readlink(path)
		if err != nil {
			return err
		}
	}

	hdr, err := archive.FileInfoHeader(name, fi, link)
	if err != nil {
		return err
	}

	_ = archive.ReadSecurityXattrToTarHeader(path, hdr)

	// if it's not a directory and has more than 1 link,
	// it's hard linked, so set the type flag accordingly
	if !fi.IsDir() && hasHardlinks(fi) {
		inode, err := getInodeFromStat(fi.Sys())
		if err != nil {
			return err
		}
		// a link should have a name that it links too
		// and that linked name should be first in the tar archive
		if oldpath, ok := ta.SeenFiles[inode]; ok {
			hdr.Typeflag = tar.TypeLink
			hdr.Linkname = oldpath
			hdr.Size = 0 // This Must be here for the writer math to add up!
		} else {
			ta.SeenFiles[inode] = name
		}
	}

	// do not asume UID an GID string exists and/or are equal outside the rings
	hdr.Uname = ""
	hdr.Gname = ""

	// check whether the file is overlayfs whiteout
	// if yes, skip re-mapping container ID mappings.
	isOverlayWhiteout := fi.Mode()&os.ModeCharDevice != 0 && hdr.Devmajor == 0 && hdr.Devminor == 0

	// handle re-mapping container ID mappings back to host ID mappings before
	// writing tar headers/files. We skip whiteout files because they were written
	// by the kernel and already have proper ownership relative to the host
	if !isOverlayWhiteout && !strings.HasPrefix(filepath.Base(hdr.Name), whiteoutPrefix) && !ta.IdentityMapping.Empty() {
		fileIDPair, err := getFileUIDGID(fi.Sys())
		if err != nil {
			return err
		}

		hdr.Uid, hdr.Gid, err = ta.IdentityMapping.ToContainer(fileIDPair)
		if err != nil {
			return err
		}
	}

	if err := ta.TarWriter.WriteHeader(hdr); err != nil {
		return err
	}

	if hdr.Typeflag == tar.TypeReg && hdr.Size > 0 {
		file, err := os.Open(path)
		if err != nil {
			return err
		}

		ta.Buffer.Reset(ta.TarWriter)
		defer ta.Buffer.Reset(nil)
		_, err = io.Copy(ta.Buffer, file)
		file.Close()
		if err != nil {
			return err
		}
		err = ta.Buffer.Flush()
		if err != nil {
			return err
		}
	}

	return nil
}

func hasHardlinks(fi os.FileInfo) bool {
	return fi.Sys().(*syscall.Stat_t).Nlink > 1
}

func getInodeFromStat(stat interface{}) (inode uint64, err error) {
	s, ok := stat.(*syscall.Stat_t)

	if ok {
		inode = s.Ino
	}

	return
}

func getFileUIDGID(stat interface{}) (idtools.Identity, error) {
	s, ok := stat.(*syscall.Stat_t)

	if !ok {
		return idtools.Identity{}, errors.New("cannot convert stat value to syscall.Stat_t")
	}

	return idtools.Identity{UID: int(s.Uid), GID: int(s.Gid)}, nil
}
