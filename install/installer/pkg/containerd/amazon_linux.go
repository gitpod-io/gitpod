// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package containerd

// Amazon Linux only requires a different containerd location - the socket is same as default
const (
	ContainerdLocationAmazonLinux ContainerdLocation = "/run/containerd/io.containerd.runtime.v2.task/k8s.io"
)

func init() {
	loc.AddContainerd(ContainerdLocationAmazonLinux)
}
