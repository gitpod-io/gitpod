// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanagerbridge

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/workspace/ws-manager"
)

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	rolebinding,
	common.DefaultServiceAccount(Component),
)

func WSManagerList() []WorkspaceCluster {
	return []WorkspaceCluster{{
		Name: "default",
		URL:  fmt.Sprintf("dns:///%s:%d", wsmanager.Component, wsmanager.RPCPort),
		TLS: WorkspaceClusterTLS{
			Authority:   "/ws-manager-client-tls-certs/ca.crt",
			Certificate: "/ws-manager-client-tls-certs/tls.crt",
			Key:         "/ws-manager-client-tls-certs/tls.key",
		},
		State:                WorkspaceClusterStateAvailable,
		MaxScore:             100,
		Score:                50,
		Govern:               true,
		AdmissionConstraints: nil,
	}}
}
