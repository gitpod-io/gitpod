// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dbtest

import (
	"encoding/base64"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/stretchr/testify/require"
	"testing"
)

func GetTestCipher(t *testing.T) (*db.AES256CBC, db.CipherMetadata) {
	t.Helper()

	// This is a test key also used in server tests - see components/gitpod-protocol/src/encryption/encryption-engine.spec.ts
	key, err := base64.StdEncoding.DecodeString("ZMaTPrF7s9gkLbY45zP59O0LTpLvDd/cgqPE9Ptghh8=")
	require.NoError(t, err)

	metadata := db.CipherMetadata{
		Name:    "default",
		Version: 1,
	}
	cipher, err := db.NewAES256CBCCipher(string(key), metadata)
	require.NoError(t, err)
	return cipher, metadata
}

func CipherSet(t *testing.T) *db.CipherSet {
	t.Helper()

	configs := []db.CipherConfig{
		{
			Name:     "default",
			Version:  1,
			Primary:  true,
			Material: "ZMaTPrF7s9gkLbY45zP59O0LTpLvDd/cgqPE9Ptghh8=",
		},
		{
			Name:     "secondary",
			Version:  1,
			Primary:  false,
			Material: "A3iUCT27LVbN67Fa+yfcMmLgNFdUWEl22JcdoER44gA=",
		},
	}

	set, err := db.NewCipherSet(configs)
	require.NoError(t, err)

	return set
}
