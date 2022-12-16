// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"crypto/rand"
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

func TestCipherSet(t *testing.T) {
	t.Run("errors when no config specified", func(t *testing.T) {
		_, err := db.NewCipherSet(nil)
		require.Error(t, err)
	})

	t.Run("errors when no primary configs", func(t *testing.T) {
		_, err := db.NewCipherSet([]db.CipherConfig{
			{
				Name:     "first",
				Version:  0,
				Primary:  false,
				Material: "something",
			},
			{
				Name:     "second",
				Version:  0,
				Primary:  false,
				Material: "something else",
			},
		})
		require.Error(t, err)
	})

	t.Run("errors when multiple primary configs", func(t *testing.T) {
		_, err := db.NewCipherSet([]db.CipherConfig{
			{
				Name:     "first",
				Version:  0,
				Primary:  true,
				Material: "something",
			},
			{
				Name:     "second",
				Version:  0,
				Primary:  true,
				Material: "something else",
			},
		})
		require.Error(t, err)
	})

	t.Run("uses primary to encrypt", func(t *testing.T) {
		cipherset, err := db.NewCipherSet([]db.CipherConfig{
			{
				Name:     "first",
				Version:  1,
				Primary:  true,
				Material: base64.StdEncoding.EncodeToString(generateSecret(t, 32)),
			},
			{
				Name:     "second",
				Version:  0,
				Primary:  false,
				Material: base64.StdEncoding.EncodeToString(generateSecret(t, 32)),
			},
		})
		require.NoError(t, err)

		data := []byte(`random`)
		encrypted, err := cipherset.Encrypt(data)
		require.NoError(t, err)
		require.Equal(t, "first", encrypted.Metadata.Name)
		require.Equal(t, 1, encrypted.Metadata.Version)
	})

	t.Run("uses all to decrypt", func(t *testing.T) {
		data := []byte(`random`)

		// Construct a cipher, and encrypt some data. This serves as an "old" encrypted piece
		secret := generateSecret(t, 32)
		metadata := db.CipherMetadata{
			Name:    "second",
			Version: 0,
		}
		oldCipher, err := db.NewAES256CBCCipher(string(secret), metadata)
		require.NoError(t, err)

		encrypted, err := oldCipher.Encrypt(data)
		require.NoError(t, err)

		cipherset, err := db.NewCipherSet([]db.CipherConfig{
			{
				Name:     "first",
				Version:  0,
				Primary:  true,
				Material: base64.StdEncoding.EncodeToString(generateSecret(t, 32)),
			},
			{
				Name:     metadata.Name,
				Version:  metadata.Version,
				Primary:  false,
				Material: base64.StdEncoding.EncodeToString(secret),
			},
		})
		require.NoError(t, err)

		decrypted, err := cipherset.Decrypt(encrypted)
		require.NoError(t, err)
		require.Equal(t, string(data), string(decrypted))
	})

	t.Run("no matching metadata returns an error when decrypting", func(t *testing.T) {
		encrypted := db.EncryptedData{
			EncodedData: "foobar",
			Params:      db.KeyParams{},
			Metadata: db.CipherMetadata{
				Name:    "non-existent",
				Version: 0,
			},
		}

		cipherset := dbtest.CipherSet(t)
		_, err := cipherset.Decrypt(encrypted)
		require.Error(t, err)
	})

}

func generateSecret(t *testing.T, size int) []byte {
	t.Helper()

	b := make([]byte, size)
	_, err := rand.Read(b)
	require.NoError(t, err)

	return b
}
