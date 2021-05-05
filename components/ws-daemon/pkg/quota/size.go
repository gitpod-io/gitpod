// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package quota

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"

	"golang.org/x/xerrors"
)

// Size denotes a filesize / amount of bytes
type Size int64

const (
	// Byte is a single byte
	Byte Size = 1
	// Kilobyte is 1024 bytes
	Kilobyte Size = 1024 * Byte
	// Megabyte is 1024 kilobytes
	Megabyte Size = 1024 * Kilobyte
	// Gigabyte is 1024 megabytes
	Gigabyte Size = 1024 * Megabyte
	// Terabyte is 1024 gigabyte
	Terabyte Size = 1024 * Gigabyte
)

var (
	sizeRegexp = regexp.MustCompile(`(\d+)(k|m|g|t)?`)

	// ErrInvalidSize is returned by ParseSize if input was not a valid size
	ErrInvalidSize = errors.New("invalid size")
)

// ParseSize parses a number of bytes (e.g. 10) into a size.
// ParseSize supports units: k(ilobyte), m(egabyte), (g)igatebyte, (t)erabyte. E.g. 50m or 200g
func ParseSize(q string) (Size, error) {
	matches := sizeRegexp.FindSubmatch([]byte(q))
	if len(matches) == 0 {
		return 0, ErrInvalidSize
	}

	val, err := strconv.ParseUint(string(matches[1]), 10, 64)
	if err != nil {
		return 0, ErrInvalidSize
	}
	size := Size(val)

	unit := string(matches[2])
	switch unit {
	case "":
		size = size * Byte
	case "k":
		size = size * Kilobyte
	case "m":
		size = size * Megabyte
	case "g":
		size = size * Gigabyte
	case "t":
		size = size * Terabyte
	}

	return size, nil
}

// String converts the size to a string
func (s Size) String() string {
	if s == 0 {
		return "0"
	}

	steps := []struct {
		Prefix string
		Q      Size
	}{
		{"t", Terabyte},
		{"g", Gigabyte},
		{"m", Megabyte},
		{"k", Kilobyte},
	}
	for _, stp := range steps {
		if s%stp.Q == 0 {
			return fmt.Sprintf("%d%s", s/stp.Q, stp.Prefix)
		}
	}
	return fmt.Sprintf("%d", s)
}

// MarshalJSON marshals a duration to JSON
func (s Size) MarshalJSON() ([]byte, error) {
	return json.Marshal(s.String())
}

// UnmarshalJSON unmarshals a duration from JSON
func (s *Size) UnmarshalJSON(b []byte) error {
	var v interface{}
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	switch value := v.(type) {
	case string:
		if value == "" {
			*s = 0
			return nil
		}

		tmp, err := ParseSize(value)
		if err != nil {
			return err
		}
		*s = tmp
		return nil
	default:
		return xerrors.Errorf("invalid size: %s", string(b))
	}
}
