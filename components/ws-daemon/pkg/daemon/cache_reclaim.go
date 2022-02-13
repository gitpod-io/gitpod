// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"bufio"
	"context"
	"io/ioutil"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"golang.org/x/xerrors"
)

type CacheReclaim string

// WorkspaceAdded will customize the cgroups for every workspace that is started
func (c CacheReclaim) WorkspaceAdded(ctx context.Context, ws *dispatch.Workspace) error {
	disp := dispatch.GetFromContext(ctx)
	if disp == nil {
		return xerrors.Errorf("no dispatch available")
	}

	cgroupPath, err := disp.Runtime.ContainerCGroupPath(context.Background(), ws.ContainerID)
	if err != nil {
		return xerrors.Errorf("cannot start governer: %w", err)
	}

	memPath := filepath.Join(string(c), "memory", cgroupPath)

	go func() {
		owi := ws.OWI()
		log.WithFields(ws.OWI()).Debug("starting page cache reclaim")

		t := time.NewTicker(10 * time.Second)
		defer t.Stop()

		var lastReclaim time.Time
		for {
			select {
			case <-ctx.Done():
				log.WithFields(owi).Debug("shutting down page cache reclaim")
				return
			case <-t.C:
			}

			if !lastReclaim.IsZero() && time.Since(lastReclaim) < 30*time.Second {
				continue
			}

			stats, err := reclaimPageCache(memPath)
			if err != nil {
				log.WithFields(owi).WithError(err).Warn("cannot reclaim page cache")
				continue
			}
			e := log.WithFields(owi).WithField("reclaimed_bytes", stats.Reclaimed()).WithField("stats", stats)
			if stats.DidReclaim {
				e.Debug("reclaimed page cache")
			} else {
				e.Debug("did not reclaim page cache")
			}
			lastReclaim = time.Now()
		}
	}()

	return nil
}

type reclaimStats struct {
	CacheBefore, CacheAfter uint64
	Limit                   uint64
	DidReclaim              bool
}

func (r *reclaimStats) Reclaimed() int64 {
	return int64(r.CacheBefore) - int64(r.CacheAfter)
}

func reclaimPageCache(memCgroupPath string) (stats *reclaimStats, err error) {
	cache, err := readCache(memCgroupPath)
	if err != nil {
		return nil, err
	}
	limit, err := readLimit(memCgroupPath)
	if err != nil {
		return nil, err
	}

	var didReclaim bool
	if cache > uint64(float64(limit)*0.15) {
		err := ioutil.WriteFile(filepath.Join(memCgroupPath, "memory.force_empty"), []byte("1"), 0644)
		if err != nil {
			return nil, xerrors.Errorf("cannot write memory.force_empty: %v", err)
		}
		didReclaim = true
	}

	nowCache, _ := readCache(memCgroupPath)
	return &reclaimStats{
		CacheBefore: cache,
		CacheAfter:  nowCache,
		Limit:       limit,
		DidReclaim:  didReclaim,
	}, nil
}

func readLimit(memCgroupPath string) (uint64, error) {
	fn := filepath.Join(string(memCgroupPath), "memory.limit_in_bytes")
	fc, err := os.ReadFile(fn)
	if err != nil {
		return 0, xerrors.Errorf("cannot read memory.limit_in_bytes: %v", err)
	}

	s := strings.TrimSpace(string(fc))
	if s == "max" {
		return math.MaxUint64, nil
	}

	p, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return 0, xerrors.Errorf("cannot parse memory.limit_in_bytes (%s): %v", s, err)
	}
	return p, nil
}

func readCache(memCgroupPath string) (uint64, error) {
	f, err := os.Open(filepath.Join(string(memCgroupPath), "memory.stat"))
	if err != nil {
		return 0, xerrors.Errorf("cannot read memory.stat: %w", err)
	}
	defer f.Close()

	const prefixCache = "cache "

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		l := scanner.Text()
		if !strings.HasPrefix(l, prefixCache) {
			continue
		}

		r, err := strconv.ParseUint(strings.TrimSpace(strings.TrimPrefix(l, prefixCache)), 10, 64)
		if err != nil {
			return 0, xerrors.Errorf("cannot parse memory.stat: %s: %w", l, err)
		}
		return r, nil
	}
	return 0, xerrors.Errorf("memory.stat did not contain cache")
}
