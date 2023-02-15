// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package origin

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestToFromContext(t *testing.T) {
	require.Equal(t, "some-origin", FromContext(ToContext(context.Background(), "some-origin")), "origin stored on context is extracted")
	require.Equal(t, "", FromContext(context.Background()), "context without origin value returns empty")
}
