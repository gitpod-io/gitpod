// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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
