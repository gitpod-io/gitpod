// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"encoding/base64"
	"fmt"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestAES256CBCCipher_Encrypt_Decrypt(t *testing.T) {
	secret := "testtesttesttesttesttesttesttest"

	metadata := db.CipherMetadata{
		Name:    "general",
		Version: 1,
	}

	cipher, err := db.NewAES256CBCCipher(secret, metadata)
	require.NoError(t, err)

	data := []byte(`{ "foo": "bar", "another": "one" }`)

	encrypted, err := cipher.Encrypt(data)
	require.NoError(t, err)

	iv, err := base64.StdEncoding.DecodeString(encrypted.Params.InitializationVector)
	require.NoError(t, err, "initialization vector must be stored as base64")
	require.NotEmpty(t, iv, "initialization vector must not be empty")

	decodedCipherText, err := base64.StdEncoding.DecodeString(encrypted.EncodedData)
	require.NoError(t, err, "encrypted data must be base64 encoded")
	require.NotEmpty(t, decodedCipherText, "decoded cipher text must not be emtpy")

	require.Equal(t, metadata, encrypted.Metadata)
	require.NotEmpty(t, encrypted.Params.InitializationVector)

	decrypted, err := cipher.Decrypt(encrypted)
	require.NoError(t, err)
	require.Equal(t, data, decrypted)
}

func TestAES256CBCCipher_EncryptedByServer(t *testing.T) {
	cipher, metadata := dbtest.GetTestCipher(t)
	encrypted := db.EncryptedData{
		EncodedData: "YpgOY8ZNV64oG1DXiuCUXKy0thVySbN7uXTQxtC2j2A=",
		Params: db.KeyParams{
			InitializationVector: "vpTOAFN5v4kOPsAHBKk+eg==",
		},
		Metadata: metadata,
	}

	decrypted, err := cipher.Decrypt(encrypted)
	fmt.Println(err)
	require.NoError(t, err)
	require.Equal(t, "12345678901234567890", string(decrypted))
}
