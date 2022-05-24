// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"database/sql/driver"
	"errors"
	"fmt"
	"github.com/relvacode/iso8601"
	"time"
)

func NewVarcharTime(t time.Time) VarcharTime {
	return VarcharTime(t.UTC())
}

func NewVarcharTimeFromStr(s string) (VarcharTime, error) {
	parsed, err := iso8601.ParseString(string(s))
	if err != nil {
		return VarcharTime{}, fmt.Errorf("failed to parse as ISO 8601: %w", err)
	}
	return VarcharTime(parsed), nil
}

// VarcharTime exists for cases where records are inserted into the DB as VARCHAR but actually contain a timestamp which is time.RFC3339
type VarcharTime time.Time

// Scan implements the Scanner interface.
func (n *VarcharTime) Scan(value interface{}) error {
	if value == nil {
		return fmt.Errorf("nil value")
	}

	switch s := value.(type) {
	case []uint8:
		if len(s) == 0 {
			return errors.New("failed to parse empty varchar time")
		}

		parsed, err := iso8601.ParseString(string(s))
		if err != nil {
			return fmt.Errorf("failed to parse %v into ISO8601: %w", string(s), err)
		}
		*n = VarcharTime(parsed.UTC())
		return nil
	}
	return fmt.Errorf("unknown scan value for VarcharTime with value: %v", value)
}

// Value implements the driver Valuer interface.
func (n VarcharTime) Value() (driver.Value, error) {
	return time.Time(n).UTC().Format(time.RFC3339Nano), nil
}

func (n VarcharTime) String() string {
	return time.Time(n).Format(time.RFC3339Nano)
}
