// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	"fmt"
	"net"
	"strconv"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
)

const (
	localhost = "127.0.0.1"
)

func LocalhostAddressFromPort(port int) string {
	return fmt.Sprintf("%v:%v", localhost, port)
}

func LocalhostPrometheusAddr() string {
	return LocalhostAddressFromPort(baseserver.BuiltinMetricsPort)
}

func LocalhostPprofAddr() string {
	return LocalhostAddressFromPort(baseserver.BuiltinDebugPort)
}

func ClusterAddress(serviceName string, namespace string, port int) string {
	return net.JoinHostPort(fmt.Sprintf("%s.%s.svc.cluster.local", serviceName, namespace), strconv.Itoa(port))
}

func ClusterURL(protocol string, serviceName string, namespace string, port int) string {
	return fmt.Sprintf("%s://%s", protocol, ClusterAddress(serviceName, namespace, port))
}
