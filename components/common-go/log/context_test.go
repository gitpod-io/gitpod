package log

import (
	"context"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestToFromContext(t *testing.T) {
	ctx := context.Background()
	logger := New()

	withLogger := ToContext(ctx, logger)
	loggerFromContext := FromContext(withLogger)
	require.Equal(t, logger, loggerFromContext)
}
