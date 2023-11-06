// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dashboard

const (
	Component     = "dashboard"
	ContainerPort = 80
	PortName      = "http"
	ServicePort   = 3001
	ReadinessPort = 8080

	// We need a new service account because
	// - Update old one will make preview env / dedicated deploy failed with err
	//   The RoleBinding "dashboard" is invalid: roleRef: Invalid value: rbac.RoleRef{APIGroup:"rbac.authorization.k8s.io", Kind:"Role", Name:"dashboard"}: cannot change roleRef
	// - Add new one will not work for dedicated since it will not clean old resources
	ComponentServiceAccount = "dashboard-service-account"
)
