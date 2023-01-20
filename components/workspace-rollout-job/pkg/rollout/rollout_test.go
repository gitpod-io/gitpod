// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package rollout

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

type MockAnalyzer struct {
}

func (m *MockAnalyzer) MoveForward(ctx context.Context, clusterName string) (int, error) {
	return 1, nil
}

type FailureMockAnalyzer struct {
	currentStep int
	FailureStep int
}

func (m *FailureMockAnalyzer) MoveForward(ctx context.Context, clusterName string) (int, error) {
	if m.currentStep == m.FailureStep {
		return -1, nil
	}

	m.currentStep++
	return 1, nil
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
	rolloutJob := New("ws-1", "ws-2", 1*time.Second, 1*time.Second, 25, 50, &MockAnalyzer{}, rolloutAction)
	rolloutJob.Start(context.Background())

	newClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-2")
	assert.NoError(t, err)
	assert.Equal(t, int32(100), newClusterScore)

	oldClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-1")
	assert.NoError(t, err)
	assert.Equal(t, int32(0), oldClusterScore)

}

func TestRollout_InitialFailure(t *testing.T) {
	rolloutAction := NewMockRolloutAction()
	rolloutJob := New("ws-1", "ws-2", 1*time.Second, 1*time.Second, 25, 50, &FailureMockAnalyzer{}, rolloutAction)
	rolloutJob.Start(context.Background())

	newClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-2")
	assert.NoError(t, err)
	assert.Equal(t, int32(0), newClusterScore)

	oldClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-1")
	assert.NoError(t, err)
	assert.Equal(t, int32(100), oldClusterScore)

}

func TestRollout_MidpointFailure(t *testing.T) {
	rolloutAction := NewMockRolloutAction()
	rolloutJob := New("ws-1", "ws-2", 1*time.Second, 1*time.Second, 25, 50, &FailureMockAnalyzer{FailureStep: 2}, rolloutAction)
	rolloutJob.Start(context.Background())

	newClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-2")
	assert.NoError(t, err)
	assert.Equal(t, int32(0), newClusterScore)

	oldClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-1")
	assert.NoError(t, err)
	assert.Equal(t, int32(100), oldClusterScore)
}

type ErrorMockAnalyzer struct{}

func (m *ErrorMockAnalyzer) MoveForward(ctx context.Context, clusterName string) (int, error) {
	return 1, errors.New("error")
}

func TestRollout_AnalysisError(t *testing.T) {
	rolloutAction := NewMockRolloutAction()
	rolloutJob := New("ws-1", "ws-2", 1*time.Second, 1*time.Second, 25, 50, &ErrorMockAnalyzer{}, rolloutAction)
	rolloutJob.Start(context.Background())

	// Should've rolled back due to the error
	newClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-2")
	assert.NoError(t, err)
	assert.Equal(t, int32(0), newClusterScore)

	oldClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-1")
	assert.NoError(t, err)
	assert.Equal(t, int32(100), oldClusterScore)
}

type NoDataMockAnalyzer struct{}

func (m *NoDataMockAnalyzer) MoveForward(ctx context.Context, clusterName string) (int, error) {
	return 0, nil
}

func TestRollout_AnalysisNoData(t *testing.T) {
	rolloutAction := NewMockRolloutAction()
	rolloutJob := New("ws-1", "ws-2", 1*time.Second, 1*time.Second, 10, 50, &NoDataMockAnalyzer{}, rolloutAction)
	rolloutJob.Start(context.Background())

	// Should've rolled back due to the error
	newClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-2")
	assert.NoError(t, err)
	assert.Equal(t, int32(0), newClusterScore)

	oldClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-1")
	assert.NoError(t, err)
	assert.Equal(t, int32(100), oldClusterScore)
}

type ProgressiveMockAnalyzer struct {
	currentStep int
	endResult   int
}

func (m *ProgressiveMockAnalyzer) MoveForward(ctx context.Context, clusterName string) (int, error) {
	if m.currentStep <= 3 {
		m.currentStep++
		return 0, nil
	}

	// Return Positive
	return m.endResult, nil
}

func TestRollout_AnalysisProgressivePositiveData(t *testing.T) {
	rolloutAction := NewMockRolloutAction()
	rolloutJob := New("ws-1", "ws-2", 1*time.Second, 1*time.Second, 5, 50, &ProgressiveMockAnalyzer{endResult: 1}, rolloutAction)
	rolloutJob.Start(context.Background())

	newClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-2")
	assert.NoError(t, err)
	assert.Equal(t, int32(100), newClusterScore)

	oldClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-1")
	assert.NoError(t, err)
	assert.Equal(t, int32(0), oldClusterScore)
}

func TestRollout_AnalysisProgressiveNegativeData(t *testing.T) {
	rolloutAction := NewMockRolloutAction()
	rolloutJob := New("ws-1", "ws-2", 1*time.Second, 1*time.Second, 10, 50, &ProgressiveMockAnalyzer{endResult: -1}, rolloutAction)
	rolloutJob.Start(context.Background())

	// Should've rolled back due to the negative error
	newClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-1")
	assert.NoError(t, err)
	assert.Equal(t, int32(100), newClusterScore)

	oldClusterScore, err := rolloutAction.GetScore(context.Background(), "ws-2")
	assert.NoError(t, err)
	assert.Equal(t, int32(0), oldClusterScore)
}
