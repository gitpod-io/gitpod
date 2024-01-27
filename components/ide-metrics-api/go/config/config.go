// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"bytes"
	"encoding/json"
	"os"

	"github.com/gitpod-io/gitpod/common-go/grpc"
	"golang.org/x/xerrors"
)

type LabelAllowList struct {
	Name         string   `json:"name"`
	AllowValues  []string `json:"allowValues"`
	DefaultValue string   `json:"defaultValue"`
}

type ClientAllowList = LabelAllowList

type MetricsServerConfiguration struct {
	Port                       int                             `json:"port"`
	RateLimits                 map[string]grpc.RateLimit       `json:"ratelimits"`
	CounterMetrics             []CounterMetricsConfiguration   `json:"counterMetrics"`
	HistogramMetrics           []HistogramMetricsConfiguration `json:"histogramMetrics"`
	AggregatedHistogramMetrics []HistogramMetricsConfiguration `json:"aggregatedHistogramMetrics"`
	ErrorReporting             ErrorReportingConfiguration     `json:"errorReporting"`
}

type CounterMetricsConfiguration struct {
	Name   string           `json:"name"`
	Help   string           `json:"help"`
	Labels []LabelAllowList `json:"labels"`
	Client *ClientAllowList `json:"client"`
}

type HistogramMetricsConfiguration struct {
	Name    string           `json:"name"`
	Help    string           `json:"help"`
	Labels  []LabelAllowList `json:"labels"`
	Buckets []float64        `json:"buckets"`
	Client  *ClientAllowList `json:"client"`
}

type ErrorReportingConfiguration struct {
	AllowComponents []string `json:"allowComponents"`
}

type ServiceConfiguration struct {
	Server MetricsServerConfiguration `json:"server"`

	Debug bool `json:"debug"`

	PProf struct {
		Addr string `json:"addr"`
	} `json:"pprof"`

	Prometheus struct {
		Addr string `json:"addr"`
	} `json:"prometheus"`
}

func Read(fn string) (*ServiceConfiguration, error) {
	ctnt, err := os.ReadFile(fn)
	if err != nil {
		return nil, xerrors.Errorf("cannot read config file: %w", err)
	}

	var cfg ServiceConfiguration
	dec := json.NewDecoder(bytes.NewReader(ctnt))
	dec.DisallowUnknownFields()
	err = dec.Decode(&cfg)
	if err != nil {
		return nil, xerrors.Errorf("cannot parse config file: %w", err)
	}

	return &cfg, nil
}
