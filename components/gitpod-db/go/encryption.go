// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
)

type Encryptor interface {
	Encrypt(data []byte) (EncryptedData, error)
}

type Decryptor interface {
	Decrypt(data EncryptedData) ([]byte, error)
}

type Cipher interface {
	Encryptor
	Decryptor
}

func NewAES256CBCCipher(secret string, metadata CipherMetadata) (*AES256CBC, error) {
	block, err := aes.NewCipher([]byte(secret))
	if err != nil {
		return nil, fmt.Errorf("failed to initialize AES 256 CBC cipher block: %w", err)
	}

	return &AES256CBC{
		block:    block,
		metadata: metadata,
	}, nil
}

type AES256CBC struct {
	block    cipher.Block
	metadata CipherMetadata
}

func (c *AES256CBC) Encrypt(data []byte) (EncryptedData, error) {
	iv, err := GenerateInitializationVector(16)
	if err != nil {
		return EncryptedData{}, err
	}

	// In CBC mode, the plaintext has to be padded to align with the cipher's block size
	plaintext := pad(data, c.block.BlockSize())
	ciphertext := make([]byte, len(plaintext))

	cbc := cipher.NewCBCEncrypter(c.block, iv)
	cbc.CryptBlocks(ciphertext, plaintext)

	encoded := base64.StdEncoding.EncodeToString(ciphertext)
	return EncryptedData{
		EncodedData: encoded,
		Params: KeyParams{
			InitializationVector: base64.StdEncoding.EncodeToString(iv),
		},
		Metadata: c.metadata,
	}, nil
}

func (c *AES256CBC) Decrypt(data EncryptedData) ([]byte, error) {
	if data.Metadata != c.metadata {
		return nil, errors.New("cipher metadata does not match")
	}

	if data.Params.InitializationVector == "" {
		return nil, errors.New("encrypted data does not contain an initialization vector")
	}

	ciphertext, err := base64.StdEncoding.DecodeString(data.EncodedData)
	if err != nil {
		return nil, fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	plaintext := make([]byte, len(ciphertext))

	iv, err := base64.StdEncoding.DecodeString(data.Params.InitializationVector)
	if err != nil {
		return nil, fmt.Errorf("failed to decode initialize vector from base64: %w", err)
	}

	cbc := cipher.NewCBCDecrypter(c.block, iv)
	cbc.CryptBlocks(plaintext, ciphertext)

	// In CBC mode, the plaintext was padded to align with the cipher's block size, we need to trim
	trimmed := trim(plaintext)
	return trimmed, nil
}

type KeyParams struct {
	InitializationVector string `json:"iv"`
}

type CipherMetadata struct {
	Name    string `json:"name"`
	Version int    `json:"version"`
}

// EncryptedData represents the data stored in an encrypted entry
// The JSON fields must match the existing implementation on server, in
// components/gitpod-protocol/src/encryption/encryption-engine.ts
type EncryptedData struct {
	// EncodedData is base64 encoded
	EncodedData string `json:"data"`
	// Params contain additional data needed for encryption/decryption
	Params KeyParams `json:"keyParams"`
	// Metadata contains metadata about the cipher used to encrypt the data
	Metadata CipherMetadata `json:"keyMetadata"`
}

func GenerateInitializationVector(size int) ([]byte, error) {
	buf := make([]byte, size)
	_, err := rand.Read(buf)
	if err != nil {
		return nil, fmt.Errorf("failed to generate initialization vector: %w", err)
	}

	return buf, nil
}

func pad(ciphertext []byte, blockSize int) []byte {
	padding := blockSize - len(ciphertext)%blockSize
	padtext := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(ciphertext, padtext...)
}
func trim(encrypt []byte) []byte {
	padding := encrypt[len(encrypt)-1]
	return encrypt[:len(encrypt)-int(padding)]
}
