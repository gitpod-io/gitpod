package grpc

import (
	"context"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"path"
	"time"
)

var (
	timeFormat = time.RFC3339
)

func NewUnaryLogInterceptor(logger *logrus.Entry) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		start := time.Now()
		service := path.Dir(info.FullMethod)[1:]
		method := path.Base(info.FullMethod)

		fields := logrus.Fields{
			"protocol":        "grpc",
			"grpc.service":    service,
			"grpc.method":     method,
			"grpc.start_time": start.Format(timeFormat),
		}
		if d, ok := ctx.Deadline(); ok {
			fields["grpc.request.deadline"] = d.Format(timeFormat)
		}
		// Attach our logger to the request context, so we can add log-fields on a per-rpc basis
		loggerWithFields := logger.WithFields(fields)
		ctx = log.ToContext(ctx, loggerWithFields)

		loggerWithFields.Infof("Started unary gRPC call %s", info.FullMethod)
		resp, err := handler(ctx, req)
		duration := time.Since(start)
		code := status.Code(err)

		// we need to grab the logger from context since the handler may have added more fields to the logger while processing it.
		fieldsAfterHandler := logrus.Fields{
			"grpc.code":        code.String(),
			"grpc.duration_ms": duration.Milliseconds(),
		}
		if err != nil {
			fieldsAfterHandler[logrus.ErrorKey] = err
		}

		log.FromContext(ctx).WithFields(fieldsAfterHandler).Logf(grpcStatusCodeToLogLevel(code), "Finished unary gRPC call %s with %s", info.FullMethod, code.String())
		return resp, err
	}
}

// DefaultCodeToLevel is the default implementation of gRPC return codes to log levels for server side.
func grpcStatusCodeToLogLevel(code codes.Code) logrus.Level {
	switch code {
	// info
	case codes.OK,
		codes.Canceled,
		codes.InvalidArgument,
		codes.NotFound,
		codes.AlreadyExists,
		codes.Unauthenticated:
		return logrus.InfoLevel

	// warn
	case codes.DeadlineExceeded,
		codes.PermissionDenied,
		codes.ResourceExhausted,
		codes.FailedPrecondition,
		codes.Aborted,
		codes.OutOfRange,
		codes.Unavailable:
		return logrus.WarnLevel

	// error
	case codes.Unknown,
		codes.Unimplemented,
		codes.Internal,
		codes.DataLoss:
		return logrus.ErrorLevel

	default:
		return logrus.ErrorLevel
	}
}
