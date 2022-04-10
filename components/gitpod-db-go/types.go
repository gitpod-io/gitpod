package db

import (
	"database/sql/driver"
	"fmt"
	"github.com/relvacode/iso8601"
	"strings"
	"time"
)

var (
	// convert iso-8601 into rfc-3339 format
	rfc3339t = strings.Replace("2015-12-23 00:00:00", " ", "T", 1) + "Z"
)

//func ParseISO8601(s string) (time.Time, error) {
//
//	t, err := time.Parse(time.RFC3339, converted)
//	if err != nil {
//		return time.Time{}, fmt.Errorf("failed to parse %s into ISO8601 timestamp: %w", s, err)
//	}
//
//	return t, nil
//}

func NewVarCharTime(t time.Time) VarCharTime {
	return VarCharTime(t.UTC())
}

// VarCharTime exists for cases where records are inserted into the DB as VARCHAR but actually contain a timestamp which is time.RFC3339
type VarCharTime time.Time

// Scan implements the Scanner interface.
func (n *VarCharTime) Scan(value interface{}) error {
	if value == nil {
		return fmt.Errorf("nil value")
	}

	switch s := value.(type) {
	case []uint8:
		parsed, err := iso8601.ParseString(string(s))
		if err != nil {
			return fmt.Errorf("failed to parse %v into ISO8601: %w", string(s), err)
		}
		*n = VarCharTime(parsed.UTC())
	}

	return nil
}

// Value implements the driver Valuer interface.
func (n VarCharTime) Value() (driver.Value, error) {
	return time.Time(n).UTC().Format(time.RFC3339Nano), nil
}

//func (n *VarCharTime) String() string {
//	return n.Time.Format(time.RFC3339)
//}
