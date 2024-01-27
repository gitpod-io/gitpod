// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"encoding/json"
	"fmt"
	"gorm.io/datatypes"
)

type EncryptedJSON[T any] datatypes.JSON

func (j *EncryptedJSON[T]) EncryptedData() (EncryptedData, error) {
	var data EncryptedData
	err := json.Unmarshal(*j, &data)
	if err != nil {
		return EncryptedData{}, fmt.Errorf("failed to unmarshal encrypted json: %w", err)
	}

	return data, nil
}

func (j *EncryptedJSON[T]) Decrypt(decryptor Decryptor) (T, error) {
	var out T
	data, err := j.EncryptedData()
	if err != nil {
		return out, fmt.Errorf("failed to obtain encrypted data: %w", err)
	}

	b, err := decryptor.Decrypt(data)
	if err != nil {
		return out, fmt.Errorf("failed to decrypt encrypted json: %w", err)
	}

	err = json.Unmarshal(b, &out)
	if err != nil {
		return out, fmt.Errorf("failed to unmarshal encrypted json: %w", err)
	}

	return out, nil
}

func EncryptJSON[T any](encryptor Encryptor, data T) (EncryptedJSON[T], error) {
	b, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal data into json: %w", err)
	}

	encrypted, err := encryptor.Encrypt(b)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt json: %w", err)
	}

	return NewEncryptedJSON[T](encrypted)
}

func NewEncryptedJSON[T any](data EncryptedData) (EncryptedJSON[T], error) {
	b, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize encrypted data into json: %w", err)
	}

	return b, nil
}
