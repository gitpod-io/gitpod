// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package rollout

import (
	"context"
	"errors"
	"os"
	"os/signal"
	"syscall"
	"time"

	logrus "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/workspace-rollout-job/pkg/analysis"
	"github.com/gitpod-io/gitpod/workspace-rollout-job/pkg/wsbridge"
)

type RollOutJob struct {
	oldCluster           string
	newCluster           string
	currentScore         int32
	okayScoreUntilNoData int32
	analyzer             analysis.Analyzer
	RolloutAction        wsbridge.RolloutAction
	rolloutStep          int32
	analysisWaitDuration time.Duration

	ticker *time.Ticker
	revert chan bool
	done   chan bool
}

func New(oldCluster, newCluster string, rolloutWaitDuration, analysisWaitDuration time.Duration, step, okayScoreUntilNoData int32, analyzer analysis.Analyzer, rolloutAction wsbridge.RolloutAction) *RollOutJob {
	return &RollOutJob{
		oldCluster:           oldCluster,
		newCluster:           newCluster,
		okayScoreUntilNoData: okayScoreUntilNoData,
		currentScore:         0,
		rolloutStep:          step,
		analyzer:             analyzer,
		RolloutAction:        rolloutAction,
		done:                 make(chan bool, 1),
		revert:               make(chan bool, 1),
		analysisWaitDuration: analysisWaitDuration,
		// move forward every waitDuration
		ticker: time.NewTicker(rolloutWaitDuration),
	}
}

// Start runs the job synchronously
func (r *RollOutJob) Start(ctx context.Context) error {
	// Handle interrupt signal
	c := make(chan os.Signal, 1)
	signal.Notify(c,
		os.Interrupt,
		syscall.SIGTERM,
	)
	go func() {
		<-c
		// sig is a ^C, handle it
		logrus.Info("Received interrupt signal, Reverting")
		r.revert <- true
	}()

	// keep checking the analyzer asynchronously to see if there is a
	// problem with the new cluster
	log := logrus.WithField("component", "rollout-job")
	go func() {
		for {
			// Run only if the revert channel is empty
			if len(r.revert) == 0 {
				// check every analysisWaitDuration
				time.Sleep(r.analysisWaitDuration)
				moveForward, err := r.analyzer.MoveForward(context.Background(), r.newCluster)
				if err != nil {
					log.Error("Analysis returned error: ", err)
					log.Info("Reverting the rollout")
					// Revert the rollout in case of analysis failure
					r.revert <- true
					return
				}

				// Analyzer says no, stop the rollout
				if moveForward == -1 {
					log.Info("Analyzer says no, stopping the rollout")
					r.revert <- true
					return
				} else if moveForward == 0 {
					log.Info("Analyzer says no data, waiting for more data")
					// Rollout okay until currentScore < okayScoreUntilNoData
					if r.currentScore >= r.okayScoreUntilNoData {
						log.Info("Current score is more than okayScoreUntilNoData, reverting the rollout")
						r.revert <- true
						return
					}
				} else {
					// Roll forward otherwise
					log.Info("Analyzer says yes, rolling forward")
				}
			}
		}
	}()

	// Initial Score Update
	log.Info("Initial Score Update")
	r.currentScore += r.rolloutStep
	if err := r.UpdateScoreWithMetricUpdate(ctx, r.newCluster, r.currentScore); err != nil {
		log.Error("Failed to update new cluster score: ", err)
		return err
	}

	if err := r.UpdateScoreWithMetricUpdate(ctx, r.oldCluster, 100-r.currentScore); err != nil {
		log.Error("Failed to update old cluster score: ", err)
		return err
	}
	log.Infof("Updated cluster scores: %s: %d, %s: %d", r.oldCluster, 100-r.currentScore, r.newCluster, r.currentScore)

	for {
		select {
		case <-r.ticker.C:
			if r.currentScore == 100 {
				log.Info("Rollout completed")
				r.Stop()
				return nil
			}

			r.currentScore += r.rolloutStep
			// TODO (ask): Handle them together? so that we don't end up in a mixed state during failure
			if err := r.UpdateScoreWithMetricUpdate(ctx, r.newCluster, r.currentScore); err != nil {
				log.Error("Failed to update new cluster score: ", err)
				return err
			}

			if err := r.UpdateScoreWithMetricUpdate(ctx, r.oldCluster, 100-r.currentScore); err != nil {
				log.Error("Failed to update old cluster score: ", err)
				return err
			}

			log.Infof("Updated cluster scores: %s: %d, %s: %d", r.oldCluster, 100-r.currentScore, r.newCluster, r.currentScore)
		case <-r.revert:
			log.Info("Reverting the rollout")

			if err := r.UpdateScoreWithMetricUpdate(ctx, r.oldCluster, 100); err != nil {
				log.Error("Failed to update new cluster score: ", err)
				return err
			}

			if err := r.UpdateScoreWithMetricUpdate(ctx, r.newCluster, 0); err != nil {
				log.Error("Failed to update new cluster score: ", err)
				return err
			}

			log.Infof("Updated cluster scores: %s: %d, %s: %d", r.oldCluster, 100, r.newCluster, 0)
			r.Stop()
			return errors.New("Rollout Reverted")

		case <-r.done:
			return nil
		}
	}
}

func (r *RollOutJob) UpdateScoreWithMetricUpdate(ctx context.Context, cluster string, score int32) error {
	if err := r.RolloutAction.UpdateScore(ctx, cluster, score); err != nil {
		scoreUpdatesFailuresTotal.WithLabelValues(cluster, err.Error()).Inc()
		return err
	}

	scoreUpdatesTotal.WithLabelValues(cluster).Inc()
	clusterScores.WithLabelValues(cluster).Set(float64(score))
	return nil
}

func (r *RollOutJob) Stop() {
	close(r.done)
	close(r.revert)
	r.ticker.Stop()
}
