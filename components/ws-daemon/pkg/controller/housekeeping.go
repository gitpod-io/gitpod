// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/opentracing/opentracing-go"
)

const minContentGCAge = 1 * time.Hour

type Housekeeping struct {
	Location string
	Interval time.Duration
}

func NewHousekeeping(location string, interval time.Duration) *Housekeeping {
	return &Housekeeping{
		Location: location,
		Interval: interval,
	}
}

func (h *Housekeeping) Start(ctx context.Context) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "Housekeeping.Start")
	defer tracing.FinishSpan(span, nil)
	log.WithField("interval", h.Interval.String()).Debug("started workspace housekeeping")

	ticker := time.NewTicker(h.Interval)
	defer ticker.Stop()

	run := true
	for run {
		var errs []error
		select {
		case <-ticker.C:
			errs = h.doHousekeeping(ctx)
		case <-ctx.Done():
			run = false
		}

		for _, err := range errs {
			log.WithError(err).Error("error during housekeeping")
		}
	}

	span.Finish()
	log.Debug("stopping workspace housekeeping")
}

func (h *Housekeeping) doHousekeeping(ctx context.Context) (errs []error) {
	span, _ := opentracing.StartSpanFromContext(ctx, "doHousekeeping")
	defer func() {
		msgs := make([]string, len(errs))
		for i, err := range errs {
			msgs[i] = err.Error()
		}

		var err error
		if len(msgs) > 0 {
			err = fmt.Errorf(strings.Join(msgs, ". "))
		}
		tracing.FinishSpan(span, &err)
	}()

	errs = make([]error, 0)

	// Find workspace directories which are left over.
	files, err := os.ReadDir(h.Location)
	if err != nil {
		return []error{fmt.Errorf("cannot list existing workspaces content directory: %w", err)}
	}

	for _, f := range files {
		if !f.IsDir() {
			continue
		}

		// If this is the -daemon directory, make sure we assume the correct state file name
		name := f.Name()
		name = strings.TrimSuffix(name, string(filepath.Separator))
		name = strings.TrimSuffix(name, "-daemon")

		if _, err := os.Stat(filepath.Join(h.Location, fmt.Sprintf("%s.workspace.json", name))); !errors.Is(err, fs.ErrNotExist) {
			continue
		}

		// We have found a workspace content directory without a workspace state file, which means we don't manage this folder.
		// Within the working area/location of a session store we must be the only one who creates directories, because we want to
		// make sure we don't leak files over time.

		// For good measure we wait a while before deleting that directory.
		nfo, err := f.Info()
		if err != nil {
			log.WithError(err).Warn("Found workspace content directory without a corresponding state file, but could not retrieve its info")
			errs = append(errs, err)
			continue
		}
		if time.Since(nfo.ModTime()) < minContentGCAge {
			continue
		}

		err = os.RemoveAll(filepath.Join(h.Location, f.Name()))
		if err != nil {
			log.WithError(err).Warn("Found workspace content directory without a corresponding state file, but could not delete the content directory")
			errs = append(errs, err)
			continue
		}

		log.WithField("directory", f.Name()).Info("deleted workspace content directory without corresponding state file")
	}

	return errs
}
