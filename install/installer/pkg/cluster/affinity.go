// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cluster

// Valid characters for affinities are alphanumeric, -, _, . and one / as a subdomain prefix
const (
	AffinityLabelMeta               = "gitpod.io/workload_meta"
	AffinityLabelIDE                = "gitpod.io/workload_ide"
	AffinityLabelServices           = "gitpod.io/workload_services"
	AffinityLabelWorkspacesRegular  = "gitpod.io/workload_workspace_regular"
	AffinityLabelWorkspacesHeadless = "gitpod.io/workload_workspace_headless"
)

var AffinityListMeta = []string{
	AffinityLabelMeta,
	AffinityLabelIDE,
	AffinityLabelServices,
}

var AffinityListWorkspace = []string{
	AffinityLabelServices,
	AffinityLabelWorkspacesRegular,
	AffinityLabelWorkspacesHeadless,
}

var AffinityList = func() []string {
	list := []string{}

	list = append(list, AffinityListMeta...)
	list = append(list, AffinityListWorkspace...)

	return list
}()
