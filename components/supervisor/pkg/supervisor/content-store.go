// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/bmatcuk/doublestar/v2"
	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	restoreIgnoreWriteError = true
	restoreSkipExisting     = false
	compressTarball         = false
	userConfigBlobName      = "user-config.tar"
)

var (
	userConfigGlobs     = []string{"/home/gitpod/.theia/**/*", "/home/gitpod/.bash_history"} // TODO
	userConfigUplaodURL string
)

func backupUserConfig(url string, globs []string) error {
	piper, pipew := io.Pipe()
	go func() {
		defer pipew.Close()
		if err := createTarball(pipew, globs); err != nil {
			log.WithError(err).Errorf("error creating tarball for user config backup")
		}
	}()
	client := &http.Client{}
	httpreq, err := http.NewRequest(http.MethodPut, url, piper)
	if err != nil {
		return err
	}
	httpresp, err := client.Do(httpreq)
	if err != nil {
		return err
	}
	_, err = ioutil.ReadAll(httpresp.Body)
	if err != nil {
		return err
	}
	return nil
}

func restoreUserConfig(url string) error {
	httpresp, err := http.Get(url)
	if err != nil {
		return err
	}
	if httpresp.StatusCode != http.StatusOK {
		return xerrors.Errorf("status code of HTTP request is not OK but '%s'", httpresp.StatusCode)
	}

	var tarReader *tar.Reader
	if compressTarball {
		gzipReader, err := gzip.NewReader(httpresp.Body)
		if err != nil {
			return err
		}
		defer gzipReader.Close()
		tarReader = tar.NewReader(gzipReader)
	} else {
		tarReader = tar.NewReader(httpresp.Body)
	}

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		filePath := header.Name
		perm := os.FileMode(header.Mode)
		if err := writeFile(tarReader, filePath, perm); err != nil {
			return err
		}
	}
	return nil
}

func createTarball(writer io.Writer, globs []string) error {
	var tarWriter *tar.Writer
	if compressTarball {
		gzipWriter := gzip.NewWriter(writer)
		defer gzipWriter.Close()

		tarWriter = tar.NewWriter(gzipWriter)
	} else {
		tarWriter = tar.NewWriter(writer)
	}
	defer tarWriter.Close()

	for _, glob := range globs {
		log.Debugf("processing glob pattern '%s' for backuping user config ...", glob)
		filePaths, err := doublestar.Glob(glob)
		if err != nil {
			return err
		}
		for _, filePath := range filePaths {
			filePath, err := filepath.Abs(filePath)
			if err != nil {
				return err
			}
			stat, err := os.Stat(filePath)
			if err != nil {
				return err
			}
			if stat.Mode().IsRegular() { // ignore dirs
				log.WithField("file", filePath).Debug("adding file to backup tar")
				if err := addFileToTarball(tarWriter, filePath); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func addFileToTarball(tarWriter *tar.Writer, filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return err
	}
	header := &tar.Header{
		Name:    filePath,
		Size:    stat.Size(),
		Mode:    int64(stat.Mode()),
		ModTime: stat.ModTime(),
	}
	if err = tarWriter.WriteHeader(header); err != nil {
		return err
	}
	if _, err = io.Copy(tarWriter, file); err != nil {
		return err
	}
	return nil
}

func writeFile(reader io.Reader, filePath string, perm os.FileMode) error {
	log.WithField("file", filePath).Debug("restoring user config file ...")
	if err := os.MkdirAll(filepath.Dir(filePath), os.ModePerm); err != nil {
		if restoreIgnoreWriteError {
			log.WithError(err).WithField("file", filePath).Debug("restoring user config file failed")
			return nil
		}
		return err
	}

	flag := os.O_WRONLY | os.O_CREATE | os.O_TRUNC // create new or truncate existing file
	if restoreSkipExisting {
		flag = os.O_WRONLY | os.O_CREATE | os.O_EXCL // create new file or fail if file exists
	}
	file, err := os.OpenFile(filePath, flag, perm)
	if os.IsExist(err) {
		log.WithField("file", filePath).Debug("skipping restoring user config file, already exists")
		return nil
	} else if err != nil {
		if restoreIgnoreWriteError {
			log.WithError(err).WithField("file", filePath).Debug("restoring user config file failed")
			return nil
		}
		return err
	}
	defer file.Close()
	if _, err = io.Copy(file, reader); err != nil {
		if restoreIgnoreWriteError {
			log.WithError(err).WithField("file", filePath).Debug("restoring user config file failed")
			return nil
		}
		return err
	}
	return nil
}

func expirationFromURL(givenURL string) (*time.Time, error) {
	u, err := url.Parse(givenURL)
	if err != nil {
		return nil, xerrors.Errorf("cannot parse URL: %v", err)
	}
	query := u.Query()
	d := query.Get("X-Goog-Date")
	if d == "" {
		d = query.Get("X-Amz-Date")
	}
	dd, err := time.Parse("20060102T150405Z", d)
	if err != nil {
		return nil, xerrors.Errorf("cannot parse X-Goog-Date/X-Amz-Date '%s': %v", d, err)
	}
	e := u.Query().Get("X-Amz-Expires")
	ee, err := strconv.Atoi(e)
	if err != nil {
		return nil, xerrors.Errorf("cannot parse X-Goog-Exipres/X-Amz-Expires '%s: %v", d, err)
	}
	exp := time.Duration(ee) * time.Second
	expires := dd.Add(exp)
	log.Debugf("url expires after %s at %s.", exp, expires)
	return &expires, nil
}

func isURLValid(url string) (bool, error) {
	expires, err := expirationFromURL(url)
	if err != nil {
		return false, err
	}
	nowWithOneMinuteGracePeriod := time.Now().Add(-time.Minute)
	b := nowWithOneMinuteGracePeriod.Before(*expires)
	if !b {
		log.WithField("now_with_1min_grace", nowWithOneMinuteGracePeriod).WithField("expires", expires).Debug("url is expired")
	}
	return b, nil
}

func downloadUserConfig(ctx context.Context, gitpodService *gitpod.APIoverJSONRPC) {
	start := time.Now()
	defer func() { log.WithField("duration", time.Since(start)).Debug("downloading user config ended") }()

	var (
		url string
		err error
	)
	url = os.Getenv("GITPOD_USER_CONFIG_DOWNLOAD_URL")
	if url != "" {
		b, err := isURLValid(url)
		if err != nil {
			log.WithField("url", url).WithError(err).Debug("URL is not valid. Acquiring a new one ...")
			url = ""
		} else if !b {
			log.WithField("url", url).Debug("URL is expired. Acquiring a new one ...")
			url = ""
		}
	}
	if url == "" {
		url, err = gitpodService.GetContentBlobDownloadURL(ctx, userConfigBlobName)
		if err != nil {
			s, ok := status.FromError(err)
			if (ok && s.Code() == codes.NotFound) || strings.Contains(err.Error(), "NOT_FOUND") {
				log.WithError(err).Debug("there is no user config to download")
			} else {
				log.WithError(err).Error("acquiring download URL failed")
			}
			return
		}
	}

	err = restoreUserConfig(url)
	if err != nil {
		log.WithError(err).Error("restoring user config failed")
	}
	log.Debug("restoring user config done")
}

func runAcquiringUserConfigUploadURL(ctx context.Context, gitpodService *gitpod.APIoverJSONRPC) {
	t := time.NewTicker(5 * time.Minute)
	for {
		url, err := gitpodService.GetContentBlobUploadURL(ctx, userConfigBlobName)
		if err != nil {
			log.WithError(err).Error("acquiring upload URL failed, trying again in 5 minutes")
		} else {
			userConfigUplaodURL = url
			expires, err := expirationFromURL(url)
			if err != nil {
				log.WithError(err).Error("getting expiration of URL failed, trying again in 5 minutes")
			} else {
				t.Reset(time.Until(expires.Add(-5 * time.Minute))) // subtract 5 min safety period
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

func uploadUserConfig(ctx context.Context, gitpodService *gitpod.APIoverJSONRPC, wg *sync.WaitGroup) {
	defer wg.Done()
	start := time.Now()
	defer func() { log.WithField("duration", time.Since(start)).Debug("uploading user config ended") }()

	var err error
	url := userConfigUplaodURL
	if url != "" {
		b, err := isURLValid(url)
		if err != nil {
			log.WithField("url", url).WithError(err).Debug("URL is not valid. Acquiring a new one ...")
			url = ""
		} else if !b {
			log.WithField("url", url).Debug("URL is expired. Acquiring a new one ...")
			url = ""
		}
	}
	if url == "" {
		url, err = gitpodService.GetContentBlobUploadURL(ctx, userConfigBlobName)
		if err != nil {
			log.WithError(err).Error("acquiring upload URL failed")
			return
		}
	}

	err = backupUserConfig(url, userConfigGlobs)
	if err != nil {
		log.WithError(err).Error("backuping user config failed")
	}
	log.Debug("backuping user config done")
}
