// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"testing"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/layer"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	corev1 "k8s.io/api/core/v1"
)

// MockContent is a mock implementation of the Content interface for testing.
type MockContent struct {
	mock.Mock
}

// other mock methods for the Content interface...

func (m *MockContent) GetContentLayer(ctx context.Context, owner, workspaceID string, initializer *csapi.WorkspaceInitializer) ([]layer.Layer, bool, error) {
	args := m.Called(ctx, owner, workspaceID, initializer)
	return args.Get(0).([]layer.Layer), args.Bool(1), args.Error(2)
}

func (m *MockContent) GetContentLayerPVC(ctx context.Context, owner, workspaceID string, initializer *csapi.WorkspaceInitializer) ([]layer.Layer, bool, error) {
	args := m.Called(ctx, owner, workspaceID, initializer)
	return args.Get(0).([]layer.Layer), args.Bool(1), args.Error(2)
}

func TestGetImageSpec(t *testing.T) {
	tests := []struct {
		Name         string
		Req          *regapi.GetImageSpecRequest
		MockPod      *corev1.Pod
		MockContent  *MockContent
		ExpectedResp *regapi.GetImageSpecResponse
		ExpectedErr  error
	}{
		// Add test cases here
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			m := &Manager{
				Content: test.MockContent,
			}
			// Mock findWorkspacePod function to return the test.MockPod
			m.findWorkspacePod = func(ctx context.Context, id string) (*corev1.Pod, error) {
				return test.MockPod, nil
			}

			resp, err := m.GetImageSpec(context.Background(), test.Req)

			if test.ExpectedErr != nil {
				assert.Error(t, err)
				assert.Equal(t, test.ExpectedErr, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, test.ExpectedResp, resp)
			}
		})
	}
}
