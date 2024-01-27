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
	"encoding/json"
	"errors"
	"fmt"
	"os"
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

type CipherConfig struct {
	Name    string `json:"name"`
	Version int    `json:"version"`
	Primary bool   `json:"primary"`
	// Material is the secret key, it is base64 encoded
	Material string `json:"material"`
}

func NewCipherSetFromKeysInFile(pathToKeys string) (*CipherSet, error) {
	b, err := os.ReadFile(pathToKeys)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var cfg []CipherConfig
	err = json.Unmarshal(b, &cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarhsal cipher config: %w", err)
	}

	return NewCipherSet(cfg)
}

func NewCipherSet(configs []CipherConfig) (*CipherSet, error) {
	if len(configs) == 0 {
		return nil, errors.New("no cipher config specified, at least one cipher config required")
	}

	primaries := findPrimaryConfigs(configs)
	if len(primaries) == 0 {
		return nil, errors.New("no primaries cipher config specified, exactly one primaries config is required")
	}
	if len(primaries) >= 2 {
		return nil, errors.New("more than one primaries cipher config specified, exactly one is requires")
	}

	primary := primaries[0]
	primaryCipher, err := cipherConfigToAES256CBC(primary)
	if err != nil {
		return nil, fmt.Errorf("failed to construct primary cipher: %w", err)
	}

	var ciphers []*AES256CBC
	for _, c := range configs {
		ciph, err := cipherConfigToAES256CBC(c)
		if err != nil {
			return nil, fmt.Errorf("failed to construct non-primary cipher for config named %s: %w", c.Name, err)
		}

		ciphers = append(ciphers, ciph)
	}

	return &CipherSet{
		ciphers: ciphers,
		primary: primaryCipher,
	}, nil
}

type CipherSet struct {
	ciphers []*AES256CBC
	primary *AES256CBC
}

func (cs *CipherSet) Encrypt(data []byte) (EncryptedData, error) {
	// We only encrypt using the primary cipher
	return cs.primary.Encrypt(data)
}

func (cs *CipherSet) Decrypt(data EncryptedData) ([]byte, error) {
	// We attempt to decrypt using all ciphers. based on matching metadata. This ensures that ciphers can be rotated over time.
	metadata := data.Metadata
	for _, c := range cs.ciphers {
		if c.metadata == metadata {
			return c.Decrypt(data)
		}
	}

	return nil, fmt.Errorf("no cipher matching metadata (%s, %d) configured", metadata.Name, metadata.Version)
}

func findPrimaryConfigs(cfgs []CipherConfig) []CipherConfig {
	var primary []CipherConfig
	for _, c := range cfgs {
		if c.Primary {
			primary = append(primary, c)
		}
	}
	return primary
}

func cipherConfigToAES256CBC(cfg CipherConfig) (*AES256CBC, error) {
	keyDecoded, err := base64.StdEncoding.DecodeString(cfg.Material)
	if err != nil {
		return nil, fmt.Errorf("failed to decode ciph config material from base64: %w", err)
	}
	ciph, err := NewAES256CBCCipher(string(keyDecoded), CipherMetadata{
		Name:    cfg.Name,
		Version: cfg.Version,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to construct AES 256 CBC ciph: %w", err)
	}
	return ciph, nil
}
