// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package jwstest

import (
	"crypto/rand"
	"crypto/rsa"
	"testing"

	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws"
	"github.com/stretchr/testify/require"
)

func GenerateKeySet(t *testing.T) jws.KeySet {
	return jws.KeySet{
		Signing: GenerateRSAPrivateKey(t, "0001"),
		Validating: []jws.Key{
			GenerateRSAPrivateKey(t, "0002"),
			GenerateRSAPrivateKey(t, "0003"),
		},
	}
}

func GenerateRSAPrivateKey(t *testing.T, id string) jws.Key {
	t.Helper()

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	return jws.Key{
		ID:      id,
		Private: privateKey,
	}
}
