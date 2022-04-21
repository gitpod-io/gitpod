package log

import (
	"github.com/sirupsen/logrus"
	"golang.org/x/net/context"
)

type ctxLoggerMarker struct{}

var (
	ctxLoggerKey = &ctxLoggerMarker{}
)

func FromContext(ctx context.Context) *logrus.Entry {
	l, ok := ctx.Value(ctxLoggerKey).(*logrus.Entry)
	if !ok || l == nil {
		return New()
	}

	return l
}

func ToContext(ctx context.Context, logger *logrus.Entry) context.Context {
	return context.WithValue(ctx, ctxLoggerKey, logger)
}
