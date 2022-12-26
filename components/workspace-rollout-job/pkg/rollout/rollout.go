// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package rollout

import (
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/workspace-rollout-job/pkg/wsbridge"
)

type RollOutJob struct {
	oldCluster    string
	newCluster    string
	prometheusURL string
	currentScore  int32

	ticker *time.Ticker
	revert chan bool
	done   chan bool
}

func New(oldCluster, newCluster, prometheusURL string) *RollOutJob {
	return &RollOutJob{
		oldCluster:    oldCluster,
		newCluster:    newCluster,
		prometheusURL: prometheusURL,
		done:          make(chan bool),
		revert:        make(chan bool),
		currentScore:  0,
		// Analyze and move forward every hour
		ticker: time.NewTicker(1 * time.Second),
	}
}

// TODO: What about error
func (r *RollOutJob) Start() {
	// Revert if the metrics aren't doing well
	go func() {
		for {
			// Check Every 10 seconds
			time.Sleep(10 * time.Second)
			// Metrics are not good {
			if true {
				close(r.revert)
			}
		}
	}()

	func() {
		for {
			select {
			case <-r.ticker.C:
				if r.currentScore == 100 {
					r.Stop()
					return
				}
				log.Infof("Updating scores as, new:%d, old:%d", r.currentScore, 100-r.currentScore)
				r.currentScore += 25
				// TODO: Have them run together
				if err := wsbridge.UpdateScore(r.newCluster, r.currentScore); err != nil {
					log.Error("Failed to update new cluster score: ", err)
				}
				if err := wsbridge.UpdateScore(r.oldCluster, 100-r.currentScore); err != nil {
					log.Error("Failed to update old cluster score: ", err)
				}

				log.Infof("Updated scores as, new:%d, old:%d", r.currentScore, 100-r.currentScore)
			case <-r.revert:
				log.Info("Reverting the rollout")
				if err := wsbridge.UpdateScore(r.newCluster, 0); err != nil {
					log.Error("Failed to update new cluster score: ", err)
				}

				if err := wsbridge.UpdateScore(r.oldCluster, 100); err != nil {
					log.Error("Failed to update old cluster score: ", err)
				}

			case <-r.done:
				// Check If
				return
			}
		}
	}()
}

func (r *RollOutJob) Stop() {
	close(r.done)
	r.ticker.Stop()
}
