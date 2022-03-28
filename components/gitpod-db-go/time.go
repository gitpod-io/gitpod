package db

// StringlyTime is a legacy timestamp defiinition
type StringlyTime string

//func (s StringlyTime) Value() (driver.Value, error) {
//}
//
//func (s StringlyTime) Scan(src any) error {
//	if val, ok := src.(string); ok {
//		s = StringlyTime(val)
//		return nil
//	}
//
//	return fmt.Errorf("failed to convert")
//}
