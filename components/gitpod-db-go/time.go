package db

import (
	"database/sql/driver"
	"fmt"
	"time"
)

// StringlyTime is a legacy timestamp defiinition
type StringlyTime struct {
	Time  time.Time
	Valid bool
}

// Scan implements the Scanner interface.
func (n *StringlyTime) Scan(value interface{}) error {
	if value == nil {
		n.Time, n.Valid = time.Time{}, false
		return nil
	}
	n.Valid = true

	switch s := value.(type) {
	case []uint8:
		parsed, err := time.Parse(time.RFC3339, string(s))
		if err != nil {
			return fmt.Errorf("failed to parse %v: %w", value, err)
		}
		n.Time = parsed
	case string:
		parsed, err := time.Parse(time.RFC3339, s)
		if err != nil {
			return fmt.Errorf("failed to parse %v: %w", value, err)
		}
		n.Time = parsed
	}

	return nil
}

// Value implements the driver Valuer interface.
func (n *StringlyTime) Value() (driver.Value, error) {
	if !n.Valid {
		return nil, nil
	}
	return n.Time, nil
}

func (n *StringlyTime) String() string {
	return n.Time.Format(time.RFC3339)
}
