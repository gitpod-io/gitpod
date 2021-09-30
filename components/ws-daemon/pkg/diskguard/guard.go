// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package diskguard

import (
	"context"
	"syscall"
	"time"

	"golang.org/x/xerrors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/util/retry"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
)

const (
	// LabelDiskPressure is set on a node if any of the guarded disks have
	// too little space available.
	LabelDiskPressure = "gitpod.io/diskPressure"
)

// Config configures the disk guard
type Config struct {
	Enabled   bool             `json:"enabled"`
	Interval  util.Duration    `json:"interval"`
	Locations []LocationConfig `json:"locations"`
}

type LocationConfig struct {
	Path          string `json:"path"`
	MinBytesAvail uint64 `json:"minBytesAvail"`
}

// FromConfig produces a set of disk space guards from the configuration
func FromConfig(cfg Config, clientset kubernetes.Interface, nodeName string) []*Guard {
	if !cfg.Enabled {
		return nil
	}

	res := make([]*Guard, len(cfg.Locations))
	for i, loc := range cfg.Locations {
		res[i] = &Guard{
			Path:          loc.Path,
			MinBytesAvail: loc.MinBytesAvail,
			Interval:      time.Duration(cfg.Interval),
			Clientset:     clientset,
			Nodename:      nodeName,
		}
	}

	return res
}

// Guard regularly checks how much free space is left on a path/disk.
// If the percentage of used space goes above a certain threshold,
// we'll label the node accordingly - and remove the label once that condition
// subsides.
type Guard struct {
	Path          string
	MinBytesAvail uint64
	Interval      time.Duration
	Clientset     kubernetes.Interface
	Nodename      string
}

// Start starts the disk guard
func (g *Guard) Start() {
	t := time.NewTicker(g.Interval)
	for {
		bvail, err := getAvailableBytes(g.Path)
		if err != nil {
			log.WithError(err).WithField("path", g.Path).Error("cannot check how much space is available")
			continue
		}
		log.WithField("bvail", bvail).WithField("minBytesAvail", g.MinBytesAvail).Debug("checked for available disk space")

		addLabel := bvail <= g.MinBytesAvail
		err = g.setLabel(LabelDiskPressure, addLabel)
		if err != nil {
			log.WithError(err).Error("cannot update node label")
		}

		<-t.C
	}
}

// setLabel adds or removes the label from the node
func (g *Guard) setLabel(label string, add bool) error {
	return retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		node, err := g.Clientset.CoreV1().Nodes().Get(ctx, g.Nodename, metav1.GetOptions{})
		if err != nil {
			return err
		}
		_, hasLabel := node.Labels[label]
		if add == hasLabel {
			return nil
		}

		if add {
			node.Labels[label] = "true"
			log.WithField("node", g.Nodename).WithField("label", label).Info("adding label to node")
		} else {
			delete(node.Labels, label)
			log.WithField("node", g.Nodename).WithField("label", label).Info("removing label from node")
		}
		_, err = g.Clientset.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
		if err != nil {
			return err
		}

		return nil
	})
}

func getAvailableBytes(path string) (bvail uint64, err error) {
	var stat syscall.Statfs_t
	err = syscall.Statfs(path, &stat)
	if err != nil {
		return 0, xerrors.Errorf("cannot stat %s: %w", path, err)
	}

	bvail = stat.Bavail * uint64(stat.Bsize)
	return
}
