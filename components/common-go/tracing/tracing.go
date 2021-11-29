// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package tracing

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"os"

	"github.com/opentracing/opentracing-go"
	tracelog "github.com/opentracing/opentracing-go/log"
	"github.com/sirupsen/logrus"
	jaeger "github.com/uber/jaeger-client-go"
	jaegercfg "github.com/uber/jaeger-client-go/config"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	"github.com/gitpod-io/gitpod/common-go/log"
)

type tracingOptions struct {
	prometheusReporter *PromReporter
}

// Option configures the tracing
type Option func(o *tracingOptions)

// WithPrometheusReporter enables the reporting of span durations as Prometheus histograms
func WithPrometheusReporter(p *PromReporter) Option {
	return func(o *tracingOptions) {
		o.prometheusReporter = p
	}
}

// Init initializes tracing for this application
func Init(serviceName string, opts ...Option) io.Closer {
	cfg, err := jaegercfg.FromEnv()
	if err != nil {
		log.WithError(err).Debug("cannot initialize Jaeger tracer from env")
		return nil
	}

	cfg.Tags = append(cfg.Tags, opentracing.Tag{
		Key:   "service.build.commit",
		Value: os.Getenv("GITPOD_BUILD_GIT_COMMIT"),
	})
	cfg.Tags = append(cfg.Tags, opentracing.Tag{
		Key:   "service.build.version",
		Value: os.Getenv("GITPOD_BUILD_VERSION"),
	})

	reporter, err := cfg.Reporter.NewReporter(serviceName, nil, nil)
	if err != nil {
		log.WithError(err).Debug("cannot initialize Jaeger tracer from env")
		return nil
	}

	var options tracingOptions
	for _, opt := range opts {
		opt(&options)
	}

	if options.prometheusReporter != nil {
		promrep := options.prometheusReporter
		err = promrep.RegisterMetrics()
		if err != nil {
			log.WithError(err).Debug("cannot register PrometheusReporter metrics - not using this reporter")
		} else {
			reporter = jaeger.NewCompositeReporter(reporter, promrep)
		}
	}

	closer, err := cfg.InitGlobalTracer(serviceName, jaegercfg.Reporter(reporter))
	if err != nil {
		log.WithError(err).Debug("cannot initialize Jaeger tracer")
		return nil
	}

	return closer
}

// FinishSpan reports an error if there is one and finishes the span
func FinishSpan(span opentracing.Span, err *error) {
	if err != nil && *err != nil {
		LogError(span, *err)
	}

	span.Finish()
}

// FromContext starts a new span from a context
func FromContext(ctx context.Context, name string) (opentracing.Span, context.Context) {
	return opentracing.StartSpanFromContext(ctx, name)
}

// ApplyOWI sets the owner, workspace and instance tags on a span
func ApplyOWI(span opentracing.Span, owi logrus.Fields) {
	for _, k := range []string{log.OwnerField, log.WorkspaceField, log.InstanceField} {
		val, ok := owi[k]
		if !ok {
			continue
		}

		span.SetTag(k, val)
	}
}

// GetTraceID extracts the ueber-trace-id from the context
func GetTraceID(span opentracing.Span) string {
	var buf bytes.Buffer
	err := opentracing.GlobalTracer().Inject(span.Context(), opentracing.Binary, &buf)
	if err != nil {
		return ""
	}

	return base64.StdEncoding.EncodeToString(buf.Bytes())
}

// FromTraceID takes the output of GetTraceID and produces an OpenTracing span from it.
// If traceID is invalid, we return nil.
func FromTraceID(traceID string) opentracing.SpanContext {
	if traceID == "" {
		return nil
	}

	decoded, err := base64.StdEncoding.DecodeString(traceID)
	if err != nil {
		// we don't want to log here as this function will be called very often and if wsman is used without
		// tracing, this would get rather spammy
		return nil
	}

	spanCtx, err := opentracing.GlobalTracer().Extract(opentracing.Binary, bytes.NewReader(decoded))
	if err != nil {
		// we don't want to log here as this function will be called very often and if wsman is used without
		// tracing, this would get rather spammy
		return nil
	}

	return spanCtx
}

// LogError logs an error and marks the span as errornous
func LogError(span opentracing.Span, err error) {
	span.LogFields(tracelog.Error(err))
	span.SetTag("error", true)
}

// LogRequestSafe logs the incoming request but redacts passwords and secrets
func LogRequestSafe(span opentracing.Span, req proto.Message) {
	LogMessageSafe(span, "request", req)
}

// LogMessageSafe logs a grpc message but redacts passwords and secrets
func LogMessageSafe(span opentracing.Span, name string, req proto.Message) {
	reqs, _ := protojson.Marshal(req)
	safeReqs, err := log.RedactJSON(reqs)

	var msg string
	if err != nil {
		msg = fmt.Sprintf("cannot redact request: %v", err)
	} else {
		msg = string(safeReqs)
	}

	span.LogKV(name, msg)
}
