// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scaler

import (
	"github.com/gitpod-io/gitpod/common-go/util"
	res "k8s.io/apimachinery/pkg/api/resource"
)

// Configuration is the configuration of the scaler
type Configuration struct {
	// Namespace is the kubernetes namespace the scaler should start buffer pods in
	Namespace string `json:"namespace"`
	// ScalingPeriod is the time to wait between creating two sets of buffer pods
	ScalingPeriod util.Duration `json:"scalingPeriod"`
	// BufferRuntime the time a scaling buffer pod should run
	BufferRuntime util.Duration `json:"bufferRuntime"`
	// BufferRAMRequest is the baseline RAM. It's multiplied with BufferFactor and then used as RAM request for buffer pods
	BufferRAMRequest res.Quantity `json:"bufferRAMRequest"`
	// SlotFactor is the factor to multiply BufferRAMRequest for each
	SlotFactor float32 `json:"slotFactor"`
	// BufferFactor is the number of buffers we want to start in parallel each scaling period
	BufferFactor int `json:"bufferFactor"`
	// NodeLabelSelector is set to the buffer pods as nodeAffinity
	NodeLabelSelector map[string]string `json:"nodeLabelSelector"`
	// SchedulerName is the name of the scheduler the scaling buffers are scheduled with
	SchedulerName string `json:"schedulerName"`
	// Stage is the stage this Gitpod is deployed to
	Stage string `json:"stage"`
	// PullSecrets the pull secrets the buffer pods images are pulled from
	PullSecrets []string `json:"pullSecrets"`
}
