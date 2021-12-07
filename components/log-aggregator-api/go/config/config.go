// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

type PProf struct {
	Addr string `json:"address"`
}

type Service struct {
	Addr string `json:"address"`
}

type ServiceConfig struct {
	AggregatorAddr string `json:"aggregatorAddr"`
	IngesterAddr   string `json:"ingesterAddr"`

	Configuration Configuration `json:"orchestrator"`
	Prometheus    Service       `json:"prometheus"`
	PProf         PProf         `json:"pprof"`
}

type Configuration struct {
	RedisAddress string `json:"redis"`
}
