// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cluster

// Valid characters for affinities are alphanumeric, -, _, . and one / as a subdomain prefix
const (
	AffinityLabelMeta               = "gitpod.io/workload_meta"
	AffinityLabelIDE                = "gitpod.io/workload_ide"
	AffinityLabelWorkspaceServices  = "gitpod.io/workload_workspace_services"
	AffinityLabelWorkspacesRegular  = "gitpod.io/workload_workspace_regular"
	AffinityLabelWorkspacesHeadless = "gitpod.io/workload_workspace_headless"
)

var AffinityList = []string{
	AffinityLabelMeta,
	AffinityLabelIDE,
	AffinityLabelWorkspaceServices,
	AffinityLabelWorkspacesRegular,
	AffinityLabelWorkspacesHeadless,
}
