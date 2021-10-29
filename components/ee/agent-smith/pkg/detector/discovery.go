// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package detector

import (
	"context"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"github.com/prometheus/client_golang/prometheus"
)

// Process describes a process ont the node that might warant closer inspection
type Process struct {
	Path        string
	CommandLine []string
	Kind        ProcessKind
	Workspace   *common.Workspace
}

// ProcessDetector discovers processes on the node
type ProcessDetector interface {
	prometheus.Collector

	// Discover starts the discovery process. The discovery process can send the same
	// process multiple times.
	DiscoverProcesses(ctx context.Context) (<-chan Process, error)
}

type ProcessKind int

const (
	ProcessUnknown ProcessKind = iota
	ProcessSandbox
	ProcessSupervisor
	ProcessUserWorkload
)
