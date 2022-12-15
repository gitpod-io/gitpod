// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"encoding/base64"
	"fmt"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestAES256CBCCipher_Encrypt_Decrypt(t *testing.T) {
	secret, err := generateInitializationVector(32)
	require.NoError(t, err)

	metadata := CipherMetadata{
		Name:    "general",
		Version: 1,
	}

	cipher, err := NewAES256CBCCipher(string(secret), metadata)
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
	// This is a test key also used in server tests - see components/gitpod-protocol/src/encryption/encryption-engine.spec.ts
	key, err := base64.StdEncoding.DecodeString("ZMaTPrF7s9gkLbY45zP59O0LTpLvDd/cgqPE9Ptghh8=")
	require.NoError(t, err)

	metadata := CipherMetadata{
		Name:    "general",
		Version: 1,
	}
	encrypted := EncryptedData{

		EncodedData: "YpgOY8ZNV64oG1DXiuCUXKy0thVySbN7uXTQxtC2j2A=",
		Params: KeyParams{
			InitializationVector: "vpTOAFN5v4kOPsAHBKk+eg==",
		},
		Metadata: metadata,
	}

	cipher, err := NewAES256CBCCipher(string(key), metadata)
	require.NoError(t, err)

	decrypted, err := cipher.Decrypt(encrypted)
	fmt.Println(err)
	require.NoError(t, err)
	require.Equal(t, "12345678901234567890", string(decrypted))
}
