package db

import (
	"database/sql/driver"
	"fmt"
	"github.com/relvacode/iso8601"
	"time"
)

func NewVarcharTime(t time.Time) VarcharTime {
	return VarcharTime(t.UTC())
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
		parsed, err := iso8601.ParseString(string(s))
		if err != nil {
			return fmt.Errorf("failed to parse %v into ISO8601: %w", string(s), err)
		}
		*n = VarcharTime(parsed.UTC())
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
