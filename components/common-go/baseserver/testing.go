package baseserver

import (
	"github.com/stretchr/testify/require"
	"testing"
)

// NewForTests constructs a *baseserver.Server which is automatically closed after the test finishes.
func NewForTests(t *testing.T, opts ...Option) *Server {
	t.Helper()

	srv, err := New("test_server", opts...)
	require.NoError(t, err)

	t.Cleanup(func() {
		require.NoError(t, srv.Close())
	})

	return srv
}
