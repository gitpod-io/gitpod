// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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
	"github.com/gitpod-io/gitpod/ide-metrics/pkg/metrics"
	"github.com/gorilla/websocket"
	grpc_logrus "github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus"
	grpcruntime "github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/rs/cors"
	"github.com/soheilhy/cmux"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

type IDEMetricsServer struct {
	config *config.ServiceConfiguration

	registry                 prometheus.Registerer
	counterMap               map[string]*allowListCollector
	histogramMap             map[string]*allowListCollector
	aggregatedHistogramMap   map[string]*allowListCollector
	reportedUnexpectedMetric map[string]struct{}

	errorReporter errorreporter.ErrorReporter

	api.UnimplementedMetricsServiceServer
}

type allowListCollector struct {
	Collector               prometheus.Collector
	Labels                  []string
	AllowLabelValues        map[string][]string
	AllowLabelDefaultValues map[string]string

	reportedUnexpected map[string]struct{}
}

const UnknownValue = "unknown"

func (c *allowListCollector) Reconcile(metricName string, labels map[string]string) map[string]string {
	reconcile := make(map[string]string)

	for label, value := range labels {
		allowValues, ok := c.AllowLabelValues[label]
		if !ok {
			key := metricName + ":" + label
			_, reported := c.reportedUnexpected[key]
			if !reported {
				c.reportedUnexpected[key] = struct{}{}
				log.WithField("metricName", metricName).
					WithField("label", label).
					Error("metrics: unexpected label name")
			}
			continue
		}
		found := false
		for _, v := range allowValues {
			if v == value || v == "*" {
				found = true
				reconcile[label] = value
				break
			}
		}
		if found {
			continue
		}
		key := metricName + ":" + label + ":" + value
		_, reported := c.reportedUnexpected[key]
		if !reported {
			c.reportedUnexpected[key] = struct{}{}
			log.WithField("metricName", metricName).
				WithField("label", label).
				WithField("value", value).
				Error("metrics: unexpected label value")
		}
		if defaultValue, ok := c.AllowLabelDefaultValues[label]; ok {
			reconcile[label] = defaultValue
		} else {
			reconcile[label] = UnknownValue
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
		reportedUnexpected:      make(map[string]struct{}),
	}
}

func (s *IDEMetricsServer) findMetric(lookup map[string]*allowListCollector, metricName string) (*allowListCollector, error) {
	c, ok := lookup[metricName]
	if ok {
		return c, nil
	}

	_, reported := s.reportedUnexpectedMetric[metricName]
	if !reported {
		s.reportedUnexpectedMetric[metricName] = struct{}{}
		log.WithField("metricName", metricName).Error("metrics: unexpected metric name")
	}
	return nil, status.Error(codes.NotFound, "metric not found")
}

func (s *IDEMetricsServer) AddCounter(ctx context.Context, req *api.AddCounterRequest) (*api.AddCounterResponse, error) {
	c, err := s.findMetric(s.counterMap, req.Name)
	if err != nil {
		return nil, err
	}
	newLabels := c.Reconcile(req.Name, req.Labels)
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
	c, err := s.findMetric(s.histogramMap, req.Name)
	if err != nil {
		return nil, err
	}
	newLabels := c.Reconcile(req.Name, req.Labels)
	histogramVec := c.Collector.(*prometheus.HistogramVec)
	histogram, err := histogramVec.GetMetricWith(newLabels)
	if err != nil {
		return nil, err
	}
	histogram.Observe(req.Value)
	return &api.ObserveHistogramResponse{}, nil
}

func (s *IDEMetricsServer) AddHistogram(ctx context.Context, req *api.AddHistogramRequest) (*api.AddHistogramResponse, error) {
	c, err := s.findMetric(s.aggregatedHistogramMap, req.Name)
	if err != nil {
		return nil, err
	}
	count := req.GetCount()
	if count <= 0 {
		return &api.AddHistogramResponse{}, nil
	}
	aggregatedHistograms := c.Collector.(*metrics.AggregatedHistograms)
	newLabels := c.Reconcile(req.Name, req.Labels)
	var labelValues []string
	for _, label := range aggregatedHistograms.Labels {
		labelValues = append(labelValues, newLabels[label])
	}
	err = aggregatedHistograms.Add(labelValues, count, req.GetSum(), req.GetBuckets())
	if err != nil {
		return nil, err
	}
	return &api.AddHistogramResponse{}, nil
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

func (s *IDEMetricsServer) registerCounterMetrics() {
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
			log.WithError(err).WithField("name", m.Name).Warn("counter: failed to register metric")
		}
	}
}

func (s *IDEMetricsServer) registerHistogramMetrics() {
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
			log.WithError(err).WithField("name", m.Name).Warn("histogram: failed to register metric")
		}
	}
}

func (s *IDEMetricsServer) registerAggregatedHistogramMetrics() {
	for _, m := range s.config.Server.AggregatedHistogramMetrics {
		if _, ok := s.aggregatedHistogramMap[m.Name]; ok {
			continue
		}
		c := newAllowListCollector(m.Labels)
		aggregatedHistograms := metrics.NewAggregatedHistograms(m.Name, m.Help, c.Labels, m.Buckets)
		c.Collector = aggregatedHistograms
		s.aggregatedHistogramMap[m.Name] = c
		err := s.registry.Register(aggregatedHistograms)
		if err != nil {
			log.WithError(err).WithField("name", m.Name).Warn("aggregated histogram: failed to register metric")
		}
	}
}

func (s *IDEMetricsServer) prepareMetrics() {
	s.registerCounterMetrics()
	s.registerHistogramMetrics()
	s.registerAggregatedHistogramMetrics()
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
		registry:                 reg,
		config:                   cfg,
		counterMap:               make(map[string]*allowListCollector),
		histogramMap:             make(map[string]*allowListCollector),
		aggregatedHistogramMap:   make(map[string]*allowListCollector),
		reportedUnexpectedMetric: make(map[string]struct{}),
		errorReporter:            r,
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
