// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package log

import (
	"context"
	"testing"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func TestExtract_GracefulWithoutEntryOnContext(t *testing.T) {
	require.NotNil(t, Extract(context.Background()))
}

func TestExtract(t *testing.T) {
	ctx := context.Background()

	require.NotNil(t, Extract(context.Background()), "graceful without a context logger")

	withContextLogger := ToContext(ctx, Log)
	require.Equal(t, Log, Extract(withContextLogger))
}

func TestAddFields(t *testing.T) {
	ctx := ToContext(context.Background(), Log)
	fields := logrus.Fields{
		"some-field": "value",
	}
	AddFields(ctx, fields)

	entry := Extract(ctx)
	require.Equal(t, entry.Data, fields)
}
