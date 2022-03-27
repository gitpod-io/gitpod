package db

import (
	"fmt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"testing"
)

func TestTeam(t *testing.T) {
	// refer https://github.com/go-sql-driver/mysql#dsn-data-source-name for details
	dsn := "gitpod:<PASS>@tcp(127.0.0.1:3306)/gitpod"
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal("could not connect to db")
	}

	team := Team{}
	if tx := db.First(&team); tx.Error != nil {
		fmt.Println(tx.Error)
	}

	fmt.Println(team)
}
