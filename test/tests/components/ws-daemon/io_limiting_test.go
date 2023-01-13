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

func TestIOLimiting(t *testing.T) {
	f := features.New("IO limiting").
		WithLabel("component", "ws-daemon").
		Assess("verify if io limiting works fine", func(ctx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			t.Parallel()
			// TODO(toru): check it with dd command
			// Note(toru): this feature is disable on a default preview env
			t.Skip("unimplemented")
			return ctx
		}).Feature()

	testEnv.Test(t, f)
}
