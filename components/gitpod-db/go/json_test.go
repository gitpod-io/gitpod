// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestEncryptJSON_DecryptJSON(t *testing.T) {
	cipher, _ := dbtest.GetTestCipher(t)

	type Data struct {
		First  string
		Second int
	}

	data := Data{
		First:  "first",
		Second: 2,
	}

	encrypted, err := db.EncryptJSON(cipher, data)
	require.NoError(t, err)

	decrypted, err := encrypted.Decrypt(cipher)
	require.NoError(t, err)

	require.Equal(t, data, decrypted)
}
