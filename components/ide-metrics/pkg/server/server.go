// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/log"
	api "github.com/gitpod-io/gitpod/ide-metrics-api"
	"github.com/gitpod-io/gitpod/ide-metrics-api/config"
	grpc_logrus "github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus"
	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/soheilhy/cmux"
	"google.golang.org/grpc"
)

type IDEMetricsServer struct {
	config *config.ServiceConfiguration

	registry     prometheus.Registerer
	counterMap   map[string]*allowListCollector
	histogramMap map[string]*allowListCollector

	api.UnimplementedMetricsServiceServer
}

type allowListCollector struct {
	Collector        prometheus.Collector
	Labels           []string
	AllowLabelValues map[string][]string
}

func (c *allowListCollector) Check(labels map[string]string) bool {
	if len(c.Labels) != len(labels) {
		return false
	}
	for label, value := range labels {
		allowValues, ok := c.AllowLabelValues[label]
		if !ok {
			return false
		}
		found := false
		for _, v := range allowValues {
			if v == value {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func newAllowListCollector(allowList []config.LabelAllowList) *allowListCollector {
	labels := make([]string, 0, len(allowList))
	allowLabelValues := make(map[string][]string)
	for _, l := range allowList {
		labels = append(labels, l.Name)
		allowLabelValues[l.Name] = l.AllowValues
	}
	return &allowListCollector{
		Labels:           labels,
		AllowLabelValues: allowLabelValues,
	}
}

func (s *IDEMetricsServer) AddCounter(ctx context.Context, req *api.AddCounterRequest) (*api.AddCounterResponse, error) {
	c, ok := s.counterMap[req.Name]
	if !ok {
		return nil, errors.New("metric not found")
	}
	if !c.Check(req.Labels) {
		return nil, errors.New("label not allow")
	}
	counterVec := c.Collector.(*prometheus.CounterVec)
	counter, err := counterVec.GetMetricWith(req.Labels)
	if err != nil {
		return nil, err
	}
	if req.Value == nil {
		counter.Inc()
	} else {
		counter.Add(float64(*req.Value))
	}
	return &api.AddCounterResponse{}, nil
}
func (s *IDEMetricsServer) ObserveHistogram(ctx context.Context, req *api.ObserveHistogramRequest) (*api.ObserveHistogramResponse, error) {
	c, ok := s.histogramMap[req.Name]
	if !ok {
		return nil, errors.New("metric not found")
	}
	if !c.Check(req.Labels) {
		return nil, errors.New("label not allow")
	}
	histogramVec := c.Collector.(*prometheus.HistogramVec)
	histogram, err := histogramVec.GetMetricWith(req.Labels)
	if err != nil {
		return nil, err
	}
	histogram.Observe(req.Value)
	return &api.ObserveHistogramResponse{}, nil
}

func (s *IDEMetricsServer) registryCounterMetrics() {
	for _, m := range s.config.Server.CounterMetrics {
		if _, ok := s.counterMap[m.Name]; ok {
			continue
		}
		c := newAllowListCollector(m.Labels)
		counterVec := prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: m.Name,
			Help: m.Help,
		}, c.Labels)
		c.Collector = counterVec
		s.counterMap[m.Name] = c
		err := s.registry.Register(counterVec)
		if err != nil {
			log.WithError(err).WithField("name", m.Name).Warn("registry metrics failed")
		}
	}
}

func (s *IDEMetricsServer) registryHistogramMetrics() {
	for _, m := range s.config.Server.HistogramMetrics {
		if _, ok := s.histogramMap[m.Name]; ok {
			continue
		}
		c := newAllowListCollector(m.Labels)
		histogramVec := prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    m.Name,
			Help:    m.Help,
			Buckets: m.Buckets,
		}, c.Labels)
		c.Collector = histogramVec
		s.histogramMap[m.Name] = c
		err := s.registry.Register(histogramVec)
		if err != nil {
			log.WithError(err).WithField("name", m.Name).Warn("registry metrics failed")
		}
	}
}

func (s *IDEMetricsServer) prepareMetrics() {
	s.registryCounterMetrics()
	s.registryHistogramMetrics()
}

func (s *IDEMetricsServer) register(grpcServer *grpc.Server) {
	api.RegisterMetricsServiceServer(grpcServer, s)
}

func (s *IDEMetricsServer) ReloadConfig(cfg *config.ServiceConfiguration) {
	// reload config only add metrics now, we don't support modify or delete metrics
	s.config = cfg
	s.prepareMetrics()
}

func NewMetricsServer(cfg *config.ServiceConfiguration, reg prometheus.Registerer) *IDEMetricsServer {
	s := &IDEMetricsServer{
		registry:     reg,
		config:       cfg,
		counterMap:   make(map[string]*allowListCollector),
		histogramMap: make(map[string]*allowListCollector),
	}
	s.prepareMetrics()
	return s
}

func (s *IDEMetricsServer) Start() error {
	l, err := net.Listen("tcp", fmt.Sprintf(":%d", s.config.Server.Port))
	if err != nil {
		return err
	}
	m := cmux.New(l)
	grpcMux := m.MatchWithWriters(cmux.HTTP2MatchHeaderFieldSendSettings("content-type", "application/grpc"))
	var opts []grpc.ServerOption
	if s.config.Debug {
		opts = append(opts,
			grpc.UnaryInterceptor(grpc_logrus.UnaryServerInterceptor(log.Log)),
			grpc.StreamInterceptor(grpc_logrus.StreamServerInterceptor(log.Log)),
		)
	}
	grpcServer := grpc.NewServer(opts...)
	s.register(grpcServer)
	go grpcServer.Serve(grpcMux)

	httpMux := m.Match(cmux.HTTP1Fast())
	routes := http.NewServeMux()
	grpcWebServer := grpcweb.WrapServer(grpcServer, grpcweb.WithWebsockets(true), grpcweb.WithWebsocketOriginFunc(func(req *http.Request) bool {
		return true
	}), grpcweb.WithOriginFunc(func(origin string) bool {
		return true
	}))

	routes.Handle("/metrics-api/", http.StripPrefix("/metrics-api", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		grpcWebServer.ServeHTTP(w, r)
	})))
	go http.Serve(httpMux, routes)

	return m.Serve()
}
