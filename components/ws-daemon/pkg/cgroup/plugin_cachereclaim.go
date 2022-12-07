// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroup

import (
	"bufio"
	"context"
	"errors"
	"io/fs"
	"io/ioutil"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/xerrors"
)

type CacheReclaim struct{}

func (c *CacheReclaim) Name() string  { return "cache-reclaim-v1" }
func (c *CacheReclaim) Type() Version { return Version1 }

func (c *CacheReclaim) Apply(ctx context.Context, opts *PluginOptions) error {
	memPath := filepath.Join(string(opts.BasePath), "memory", opts.CgroupPath)

	t := time.NewTicker(10 * time.Second)
	defer t.Stop()

	var lastReclaim time.Time
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-t.C:
		}

		if !lastReclaim.IsZero() && time.Since(lastReclaim) < 30*time.Second {
			continue
		}

		_, err := reclaimPageCache(memPath)
		if err != nil {
			continue
		}
		lastReclaim = time.Now()
	}
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
		// We have a race between the dispatch noticing that a workspace is stopped
		// and the container going away. Hence we might be running for workspace
		// container which no longer exist, i.e. their cgroup files no longer exist.
		if errors.Is(err, fs.ErrNotExist) {
			return 0, nil
		}

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
		// TODO(toru): find out why the file does not exists
		if errors.Is(err, fs.ErrNotExist) {
			return 0, nil
		}

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
