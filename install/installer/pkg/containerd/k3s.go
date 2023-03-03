// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package containerd

// k3s stores both socket and containerd in a different location
const (
	ContainerdLocationK3s       ContainerdLocation       = "/run/k3s/containerd/io.containerd.runtime.v2.task/k8s.io"
	ContainerdSocketLocationK3s ContainerdSocketLocation = "/run/k3s/containerd"
)

func init() {
	loc.AddContainerd(ContainerdLocationK3s)
	loc.AddSocket(ContainerdSocketLocationK3s)
}
