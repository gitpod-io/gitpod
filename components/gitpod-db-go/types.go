package db

import (
	"database/sql/driver"
	"fmt"
	"time"
)

func NewStringlyTime(t time.Time) StringlyTime {
	return StringlyTime(t)
}

// StringlyTime exists for cases where records are inserted into the DB as VARCHAR but actually contain a timestamp which is time.RFC3339
type StringlyTime time.Time

// Scan implements the Scanner interface.
func (n StringlyTime) Scan(value interface{}) error {
	if value == nil {
		return fmt.Errorf("nil value")
	}

	switch s := value.(type) {
	case []uint8:
		parsed, err := time.Parse(time.RFC3339, string(s))
		if err != nil {
			return fmt.Errorf("failed to parse %v: %w", value, err)
		}
		n = StringlyTime(parsed)
	}

	return nil
}

// Value implements the driver Valuer interface.
func (n StringlyTime) Value() (driver.Value, error) {

	return time.Time(n).UTC(), nil
}

//func (n *StringlyTime) String() string {
//	return n.Time.Format(time.RFC3339)
//}
