// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package selfupdate

import (
	"context"
	"crypto"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/constants"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/inconshreveable/go-update"
	"github.com/opencontainers/go-digest"
)

const (
	// GitpodCLIBasePath is the path relative to a Gitpod installation where the latest
	// binary and manifest can be found.
	GitpodCLIBasePath = "/static/bin"
)

// Manifest is the manifest of a selfupdate
type Manifest struct {
	Version  *semver.Version `json:"version"`
	Binaries []Binary        `json:"binaries"`
}

// Binary describes a single executable binary
type Binary struct {
	// URL is added when the manifest is downloaded.
	URL string `json:"-"`

	Filename string        `json:"filename"`
	OS       string        `json:"os"`
	Arch     string        `json:"arch"`
	Digest   digest.Digest `json:"digest"`
}

type FilenameParserFunc func(filename string) (os, arch string, ok bool)

var regexDefaultFilenamePattern = regexp.MustCompile(`.*-(linux|darwin|windows)-(amd64|arm64)(\.exe)?`)

func DefaultFilenameParser(filename string) (os, arch string, ok bool) {
	matches := regexDefaultFilenamePattern.FindStringSubmatch(filename)
	if matches == nil {
		return "", "", false
	}

	return matches[1], matches[2], true
}

// GenerateManifest generates a manifest for the given location
// by scanning the location for binaries following the naming convention
func GenerateManifest(version *semver.Version, loc string, filenameParser FilenameParserFunc) (*Manifest, error) {
	files, err := os.ReadDir(loc)
	if err != nil {
		return nil, err
	}

	var binaries []Binary
	for _, f := range files {
		goos, arch, ok := filenameParser(f.Name())
		if !ok {
			continue
		}

		fd, err := os.Open(filepath.Join(loc, f.Name()))
		if err != nil {
			return nil, err
		}
		dgst, err := digest.FromReader(fd)
		fd.Close()
		if err != nil {
			return nil, err
		}

		binaries = append(binaries, Binary{
			Filename: f.Name(),
			OS:       goos,
			Arch:     arch,
			Digest:   dgst,
		})
	}

	return &Manifest{
		Version:  version,
		Binaries: binaries,
	}, nil
}

// DownloadManifest downloads a manifest from the given URL.
// Expects the manifest to be at <baseURL>/manifest.json.
func DownloadManifest(ctx context.Context, baseURL string) (res *Manifest, err error) {
	defer func() {
		if err != nil {
			pth := strings.TrimSuffix(baseURL, "/") + GitpodCLIBasePath
			err = prettyprint.AddResolution(fmt.Errorf("cannot download manifest from %s/manifest.json: %w", pth, err),
				"make sure you are connected to the internet",
				"make sure you can reach "+baseURL,
			)
		}
	}()

	murl, err := url.Parse(baseURL)
	if err != nil {
		return nil, err
	}
	murl.Path = filepath.Join(murl.Path, GitpodCLIBasePath)

	originalPath := murl.Path
	murl.Path = filepath.Join(murl.Path, "manifest.json")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, murl.String(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf(resp.Status)
	}

	var mf Manifest
	err = json.NewDecoder(resp.Body).Decode(&mf)
	if err != nil {
		return nil, err
	}
	for i := range mf.Binaries {
		murl.Path = filepath.Join(originalPath, mf.Binaries[i].Filename)
		mf.Binaries[i].URL = murl.String()
	}

	return &mf, nil
}

// DownloadManifestFromActiveContext downloads the manifest from the active configuration context
func DownloadManifestFromActiveContext(ctx context.Context) (res *Manifest, err error) {
	cfg := config.FromContext(ctx)
	if cfg == nil {
		return nil, nil
	}

	gpctx, _ := cfg.GetActiveContext()
	if gpctx == nil {
		slog.Debug("no active context - autoupdate disabled")
		return
	}

	mfctx, cancel := context.WithTimeout(ctx, 1*time.Second)
	defer cancel()
	mf, err := DownloadManifest(mfctx, gpctx.Host.URL.String())
	if err != nil {
		return
	}

	return mf, nil
}

// NeedsUpdate checks if the current version is outdated
func NeedsUpdate(current *semver.Version, manifest *Manifest) bool {
	return manifest.Version.GreaterThan(current)
}

// ReplaceSelf replaces the current binary with the one from the manifest, no matter the version
// If there is no matching binary in the manifest, this function returns ErrNoBinaryAvailable.
func ReplaceSelf(ctx context.Context, manifest *Manifest) error {
	var binary *Binary
	for _, b := range manifest.Binaries {
		if b.OS != runtime.GOOS || b.Arch != runtime.GOARCH {
			continue
		}

		binary = &b
		break
	}
	if binary == nil {
		return ErrNoBinaryAvailable
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, binary.URL, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	dgst, _ := hex.DecodeString(binary.Digest.Hex())
	err = update.Apply(resp.Body, update.Options{
		Checksum:   dgst,
		Hash:       crypto.SHA256,
		TargetMode: 0755,
	})
	if err != nil && strings.Contains(err.Error(), "permission denied") && runtime.GOOS != "windows" {
		cfgfn := config.FromContext(ctx).Filename
		err = prettyprint.AddResolution(err,
			fmt.Sprintf("run `sudo {gitpod} --config %s version update`", cfgfn),
		)
	}
	return err
}

var ErrNoBinaryAvailable = errors.New("no binary available for this platform")

// Autoupdate checks if there is a newer version available and updates the binary if so
// actually updates. This function returns immediately and runs the update in the background.
// The returned function can be used to wait for the update to finish.
func Autoupdate(ctx context.Context, cfg *config.Config) func() {
	if !cfg.Autoupdate {
		return func() {}
	}

	done := make(chan struct{})
	go func() {
		defer close(done)

		var err error
		defer func() {
			if err != nil {
				slog.Debug("version check failed", "err", err)
			}
		}()
		mf, err := DownloadManifestFromActiveContext(ctx)
		if err != nil {
			return
		}
		if mf == nil {
			slog.Debug("no selfupdate version manifest available")
			return
		}

		if !NeedsUpdate(constants.Version, mf) {
			slog.Debug("no update available", "current", constants.Version, "latest", mf.Version)
			return
		}

		slog.Warn("new version available - run `"+os.Args[0]+" version update` to update", "current", constants.Version, "latest", mf.Version)
	}()

	return func() {
		select {
		case <-done:
			return
		case <-time.After(5 * time.Second):
			slog.Warn("version check is still running - press Ctrl+C to abort")
		}
	}
}
