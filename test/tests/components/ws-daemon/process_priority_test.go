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

func TestProcessPriority(t *testing.T) {
	f := features.New("process priority").
		WithLabel("component", "ws-daemon").
		Assess("check process priority of some processes of importance", func(ctx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			t.Parallel()
			t.Skip("unimplemented")
			return ctx
		}).Feature()

	testEnv.Test(t, f)
}
