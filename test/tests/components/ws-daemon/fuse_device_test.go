// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsdaemon

import (
	"context"
	"testing"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"
)

func TestFuseDevice(t *testing.T) {
	f := features.New("fuse devive").
		WithLabel("component", "ws-daemon").
		Assess("verify fuse device", func(ctx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			t.Parallel()
			// TODO(toru): check if this code works fine
			// #define _GNU_SOURCE
			// #include <unistd.h>

			// #include <sys/syscall.h>
			// #include <linux/fs.h>
			// #include <sys/types.h>
			// #include <sys/stat.h>
			// #include <fcntl.h>
			// #include <stdio.h>

			// int main() {
			//   const char* src_path = "/dev/fuse";
			//   unsigned int flags = O_RDWR;
			//   printf("RET: %ld\n", syscall(SYS_openat, AT_FDCWD, src_path, flags));
			// }
			t.Skip("unimplemented")
			return ctx
		}).Feature()

	testEnv.Test(t, f)
}
