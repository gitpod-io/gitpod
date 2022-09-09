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
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	api "github.com/gitpod-io/gitpod/ide-metrics-api"
	"github.com/gitpod-io/gitpod/ide-metrics-api/config"
	"github.com/gitpod-io/gitpod/ide-metrics/pkg/errorreporter"
	"github.com/gorilla/websocket"
	grpc_logrus "github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus"
	grpcruntime "github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/rs/cors"
	"github.com/soheilhy/cmux"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type IDEMetricsServer struct {
	config *config.ServiceConfiguration

	registry      prometheus.Registerer
	counterMap    map[string]*allowListCollector
	histogramMap  map[string]*allowListCollector
	errorReporter errorreporter.ErrorReporter

	api.UnimplementedMetricsServiceServer
}

type allowListCollector struct {
	Collector               prometheus.Collector
	Labels                  []string
	AllowLabelValues        map[string][]string
	AllowLabelDefaultValues map[string]string
}

const UnknownValue = "unknown"

func (c *allowListCollector) Reconcile(labels map[string]string) map[string]string {
	reconcile := make(map[string]string)

	for label, value := range labels {
		allowValues, ok := c.AllowLabelValues[label]
		if !ok {
			continue
		}
		found := false
		for _, v := range allowValues {
			if v == value {
				found = true
				reconcile[label] = v
				break
			}
		}
		if !found {
			if defaultValue, ok := c.AllowLabelDefaultValues[label]; ok {
				reconcile[label] = defaultValue
			} else {
				reconcile[label] = UnknownValue
			}
		}
	}
	if len(reconcile) == len(c.Labels) {
		return reconcile
	}
	for _, label := range c.Labels {
		if _, ok := reconcile[label]; ok {
			continue
		}
		if defaultValue, ok := c.AllowLabelDefaultValues[label]; ok {
			reconcile[label] = defaultValue
		} else {
			reconcile[label] = UnknownValue
		}
	}
	return reconcile
}

func newAllowListCollector(allowList []config.LabelAllowList) *allowListCollector {
	labels := make([]string, 0, len(allowList))
	allowLabelValues := make(map[string][]string)
	allowLabelDefaultValues := make(map[string]string)
	for _, l := range allowList {
		labels = append(labels, l.Name)
		allowLabelValues[l.Name] = l.AllowValues
		allowLabelDefaultValues[l.Name] = l.DefaultValue
	}
	return &allowListCollector{
		Labels:                  labels,
		AllowLabelValues:        allowLabelValues,
		AllowLabelDefaultValues: allowLabelDefaultValues,
	}
}

func (s *IDEMetricsServer) AddCounter(ctx context.Context, req *api.AddCounterRequest) (*api.AddCounterResponse, error) {
	c, ok := s.counterMap[req.Name]
	if !ok {
		return nil, errors.New("metric not found")
	}
	newLabels := c.Reconcile(req.Labels)
	counterVec := c.Collector.(*prometheus.CounterVec)
	counter, err := counterVec.GetMetricWith(newLabels)
	if err != nil {
		return nil, err
	}
	if req.Value == 0 {
		counter.Inc()
	} else {
		counter.Add(float64(req.Value))
	}
	return &api.AddCounterResponse{}, nil
}
func (s *IDEMetricsServer) ObserveHistogram(ctx context.Context, req *api.ObserveHistogramRequest) (*api.ObserveHistogramResponse, error) {
	c, ok := s.histogramMap[req.Name]
	if !ok {
		return nil, errors.New("metric not found")
	}
	newLabels := c.Reconcile(req.Labels)
	histogramVec := c.Collector.(*prometheus.HistogramVec)
	histogram, err := histogramVec.GetMetricWith(newLabels)
	if err != nil {
		return nil, err
	}
	histogram.Observe(req.Value)
	return &api.ObserveHistogramResponse{}, nil
}
func (s *IDEMetricsServer) ReportError(ctx context.Context, req *api.ReportErrorRequest) (*api.ReportErrorResponse, error) {
	if req.Component == "" || req.ErrorStack == "" {
		return nil, errors.New("request invalid")
	}
	allow := false
	for _, c := range s.config.Server.ErrorReporting.AllowComponents {
		if c == req.Component {
			allow = true
			break
		}
	}
	if !allow {
		return nil, errors.New("invalid component name")
	}
	s.errorReporter.Report(errorreporter.ReportedErrorEvent{
		Type:        "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent",
		Severity:    "ERROR",
		Message:     req.ErrorStack,
		WorkspaceID: req.WorkspaceId,
		InstanceId:  req.InstanceId,
		UserId:      req.UserId,
		Properties:  req.Properties,
		ServiceContext: errorreporter.ReportedErrorServiceContext{
			Service: req.Component,
			Version: req.Version,
		},
	})
	return &api.ReportErrorResponse{}, nil
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
	r := errorreporter.NewFromEnvironment()
	s := &IDEMetricsServer{
		registry:      reg,
		config:        cfg,
		counterMap:    make(map[string]*allowListCollector),
		histogramMap:  make(map[string]*allowListCollector),
		errorReporter: r,
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
	restMux := grpcruntime.NewServeMux()

	var opts []grpc.ServerOption
	if s.config.Debug {
		opts = append(opts,
			grpc.UnaryInterceptor(grpc_logrus.UnaryServerInterceptor(log.Log)),
			grpc.StreamInterceptor(grpc_logrus.StreamServerInterceptor(log.Log)),
		)
	}
	grpcServer := grpc.NewServer(opts...)
	grpcEndpoint := fmt.Sprintf("localhost:%d", s.config.Server.Port)

	s.register(grpcServer)
	api.RegisterMetricsServiceHandlerFromEndpoint(context.Background(), restMux, grpcEndpoint, []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())})

	go grpcServer.Serve(grpcMux)

	httpMux := m.Match(cmux.HTTP1Fast())
	routes := http.NewServeMux()
	grpcWebServer := grpcweb.WrapServer(grpcServer, grpcweb.WithWebsockets(true), grpcweb.WithWebsocketOriginFunc(func(req *http.Request) bool {
		return true
	}), grpcweb.WithOriginFunc(func(origin string) bool {
		return true
	}))

	c := cors.New(cors.Options{
		AllowOriginFunc: func(origin string) bool {
			return true
		},
		AllowedHeaders: []string{"*"},
	})

	routes.Handle("/metrics-api/", http.StripPrefix("/metrics-api", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			c.ServeHTTP(w, r, nil)
		} else if strings.Contains(r.Header.Get("Content-Type"), "application/grpc") ||
			websocket.IsWebSocketUpgrade(r) {
			grpcWebServer.ServeHTTP(w, r)
		} else {
			x := c.Handler(restMux)
			x.ServeHTTP(w, r)
		}
	})))
	go http.Serve(httpMux, routes)

	return m.Serve()
}
