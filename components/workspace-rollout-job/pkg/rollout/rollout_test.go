// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package rollout

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

type MockAnalyzer struct {
}

func (m *MockAnalyzer) MoveForward(ctx context.Context, clusterName string) (bool, error) {
	return true, nil
}

type FailureMockAnalyzer struct {
	currentStep int
	FailureStep int
}

func (m *FailureMockAnalyzer) MoveForward(ctx context.Context, clusterName string) (bool, error) {
	if m.currentStep == m.FailureStep {
		return false, nil
	}

	m.currentStep++
	return true, nil
}

type MockRolloutAction struct {
	currentScores map[string]int32
}

func NewMockRolloutAction() *MockRolloutAction {
	return &MockRolloutAction{
		currentScores: make(map[string]int32),
	}
}

func (m *MockRolloutAction) UpdateScore(ctx context.Context, clusterName string, score int32) error {
	m.currentScores[clusterName] = score
	return nil
}

func (m *MockRolloutAction) GetScore(ctx context.Context, clusterName string) (int32, error) {
	return m.currentScores[clusterName], nil
}

func TestRollout_Successful(t *testing.T) {
	rolloutAction := NewMockRolloutAction()
	rolloutJob := New("ws-1", "ws-2", 1*time.Second, 1*time.Second, 25, &MockAnalyzer{}, rolloutAction)
	rolloutJob.Start(context.Background())

	// Wait for the rollout to finish
	time.Sleep(5 * time.Second)
	newClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-2")
	assert.NoError(t, err)
	assert.Equal(t, int32(100), newClusterScore)

	oldClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-1")
	assert.NoError(t, err)
	assert.Equal(t, int32(0), oldClusterScore)
}

func TestRollout_InitialFailure(t *testing.T) {
	rolloutAction := NewMockRolloutAction()
	rolloutJob := New("ws-1", "ws-2", 1*time.Second, 1*time.Second, 25, &FailureMockAnalyzer{}, rolloutAction)
	rolloutJob.Start(context.Background())

	// Wait for the rollout to finish
	time.Sleep(5 * time.Second)
	newClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-2")
	assert.NoError(t, err)
	assert.Equal(t, int32(0), newClusterScore)

	oldClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-1")
	assert.NoError(t, err)
	assert.Equal(t, int32(100), oldClusterScore)

}

func TestRollout_MidpointFailure(t *testing.T) {
	rolloutAction := NewMockRolloutAction()
	rolloutJob := New("ws-1", "ws-2", 1*time.Second, 1*time.Second, 25, &FailureMockAnalyzer{FailureStep: 2}, rolloutAction)
	rolloutJob.Start(context.Background())

	// Wait for the rollout to finish
	time.Sleep(5 * time.Second)
	newClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-2")
	assert.NoError(t, err)
	assert.Equal(t, int32(0), newClusterScore)

	oldClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-1")
	assert.NoError(t, err)
	assert.Equal(t, int32(100), oldClusterScore)

}
