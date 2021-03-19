// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package poolkeeper

import (
	"context"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"k8s.io/client-go/kubernetes"
)

// PoolKeeper is the entity responsiple to perform the configures actions per NodePool
type PoolKeeper struct {
	Clientset *kubernetes.Clientset
	Config    *Config

	stop chan struct{}
	done chan struct{}
}

// NewPoolKeeper creates a new PoolKeeper instance
func NewPoolKeeper(clientset *kubernetes.Clientset, config *Config) *PoolKeeper {
	return &PoolKeeper{
		Clientset: clientset,
		Config:    config,

		stop: make(chan struct{}, 1),
		done: make(chan struct{}, 1),
	}
}

// Start starts the PoolKeeper and is meant to be run in a goroutine
func (pk *PoolKeeper) Start() {
	defer func() {
		close(pk.done)
	}()

	ctx, cancel := context.WithCancel(context.Background())
	for _, task := range pk.Config.Tasks {
		go func(ctx context.Context, task *Task) {
			ticker := time.NewTicker(time.Duration(task.Interval))
			for {
				log.WithField("task", task.Name).Infof("running task...")
				if task.PatchDeploymentAffinity != nil {
					task.PatchDeploymentAffinity.run(pk.Clientset)
				} else if task.KeepNodeAlive != nil {
					task.KeepNodeAlive.run(pk.Clientset, time.Now())
				}
				log.WithField("task", task.Name).Infof("task done.")

				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					continue
				}
			}
		}(ctx, task)
	}

	<-pk.stop
	log.Debug("stopping...")
	cancel()
}

// Stop stops PoolKeeper and waits until is has done so
func (pk *PoolKeeper) Stop() {
	pk.stop <- struct{}{}
	<-pk.done
}

// TimeOfDay is a time during the day. It unmarshals from JSON as hh:mm:ss string.
type TimeOfDay time.Time

// UnmarshalJSON unmarshales a time of day
func (t *TimeOfDay) UnmarshalJSON(data []byte) error {
	input := strings.Trim(string(data), "\"")
	res, err := time.Parse("15:04:05", input)
	if err != nil {
		return err
	}
	*t = TimeOfDay(res)
	return nil
}
