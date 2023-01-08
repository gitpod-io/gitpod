// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package rollout

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	clusterScores = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "rollout_step",
			Help: "The current rollout step",
		}, []string{"cluster"},
	)
)

func RegisterMetrics(registry *prometheus.Registry) {
	registry.MustRegister(clusterScores)
}
