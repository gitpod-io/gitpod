package db

import (
	"fmt"
	driver_mysql "github.com/go-sql-driver/mysql"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"time"
)

type ConnectionParams struct {
	User     string
	Password string
	Host     string
	Database string
}

func Connect(p ConnectionParams) (*gorm.DB, error) {
	loc, _ := time.LoadLocation("UTC")
	cfg := driver_mysql.Config{
		User:                 p.User,
		Passwd:               p.Password,
		Net:                  "tcp",
		Addr:                 p.Host,
		DBName:               p.Database,
		Loc:                  loc,
		AllowNativePasswords: true,
		ParseTime:            true,
	}

	dsn := cfg.FormatDSN()
	fmt.Println(dsn)

	// refer https://github.com/go-sql-driver/mysql#dsn-data-source-name for details
	//dsn := fmt.Sprintf("%s:%s@%s/%s?charset=utf8mb4&parseTime=True&loc=Local", p.User, p.Password, p.Host, p.Database)
	return gorm.Open(mysql.Open(dsn), &gorm.Config{})
}
