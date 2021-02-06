package sources

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseVersionBranch(t *testing.T) {
	testCases := []struct {
		version         string
		expectedBranch  string
		expectedVersion int64
		mustFail        bool
		expectedError   error
	}{
		{
			version:         "registry-facade-support-3049.9",
			expectedBranch:  "registry-facade-support-3049",
			expectedVersion: 9,
		},
		{
			version:         "registry.facade.support.3049.1234",
			expectedBranch:  "registry.facade.support.3049",
			expectedVersion: 1234,
		},
		{
			version:       "0.1.1",
			mustFail:      true,
			expectedError: ErrReleaseVersion,
		},
		{
			version:  "registry.facade.support.3049.",
			mustFail: true,
		},
		{
			version:  "registry.facade.support",
			mustFail: true,
		},
		{
			version:  "registry_facade_support",
			mustFail: true,
		},
	}

	for _, tc := range testCases {
		b, v, err := ParseVersionBranch(tc.version)
		if tc.mustFail {
			require.Error(t, err)
			if tc.expectedError != nil {
				require.Equal(t, tc.expectedError, err)
			}
		} else {
			require.NoError(t, err)
			require.Equal(t, tc.expectedBranch, b)
			require.Equal(t, tc.expectedVersion, v)
		}
	}
}
