// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"database/sql/driver"
	"fmt"
	"github.com/relvacode/iso8601"
	"time"
)

func NewVarcharTime(t time.Time) VarcharTime {
	return VarcharTime{
		t:     t,
		valid: true,
	}
}

func NewVarcharTimeFromStr(s string) (VarcharTime, error) {
	var vt VarcharTime
	err := vt.Scan(s)
	return vt, err
}

// VarcharTime exists for cases where records are inserted into the DB as VARCHAR but actually contain a timestamp which is time.RFC3339
type VarcharTime struct {
	t     time.Time
	valid bool
}

// Scan implements the Scanner interface.
func (n *VarcharTime) Scan(value interface{}) error {
	if value == nil {
		n.valid = false
		return nil
	}

	switch s := value.(type) {
	case []uint8:
		// Null value - empty string mean value is not set
		if len(s) == 0 {
			n.valid = false
			return nil
		}

		parsed, err := iso8601.ParseString(string(s))
		if err != nil {
			return fmt.Errorf("failed to parse %v into ISO8601: %w", string(s), err)
		}
		n.valid = true
		n.t = parsed.UTC()
		return nil
	case string:
		if len(s) == 0 {
			n.valid = false
			return nil
		}

		parsed, err := iso8601.ParseString(s)
		if err != nil {
			return fmt.Errorf("failed to parse %v into ISO8601: %w", s, err)
		}

		n.valid = true
		n.t = parsed.UTC()
		return nil
	}
	return fmt.Errorf("unknown scan value for VarcharTime with value: %v", value)
}

func (n VarcharTime) Time() time.Time {
	return n.t
}

func (n VarcharTime) IsSet() bool {
	return n.valid
}

// Value implements the driver Valuer interface.
func (n VarcharTime) Value() (driver.Value, error) {
	return n.t.UTC().Format(time.RFC3339Nano), nil
}

func (n VarcharTime) String() string {
	return n.t.Format(time.RFC3339Nano)
}
