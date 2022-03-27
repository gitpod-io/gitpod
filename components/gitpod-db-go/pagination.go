package db

type Pagination struct {
	// Limit restricts the number of results returned
	Limit int
	// Offset specifies the offset for DB query
	Offset int
}
