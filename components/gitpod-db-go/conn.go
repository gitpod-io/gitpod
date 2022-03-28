package db

import (
	"fmt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type ConnectionParams struct {
	User     string
	Password string
	Host     string
	Database string
}

func Connect(p ConnectionParams) (*gorm.DB, error) {
	// refer https://github.com/go-sql-driver/mysql#dsn-data-source-name for details
	dsn := fmt.Sprintf("%s:%s@%s/%s?charset=utf8mb4&parseTime=True&loc=Local", p.User, p.Password, p.Host, p.Database)
	return gorm.Open(mysql.Open(dsn), &gorm.Config{})
}
