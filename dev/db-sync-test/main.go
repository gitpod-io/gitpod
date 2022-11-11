package main

import (
	"flag"
	"fmt"
	"log"
	"math/rand"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

const (
	dbUser     = "root"
	dbPassword = "password"
)

type Product struct {
	ID        uint `gorm:"primarykey"`
	CreatedAt time.Time
	UpdatedAt string         `gorm:"type:timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);<-:false"`
	DeletedAt gorm.DeletedAt `gorm:"index"`
	Code      string
	Price     uint
}

func main() {
	rand.Seed(time.Now().Unix())

	// Parse commmand line arguments
	var (
		database   string
		numRecords int
	)
	flag.StringVar(&database, "database", "", "the database to work with")
	flag.IntVar(&numRecords, "n", 0, "the number of records to insert into the table")
	flag.Parse()

	// Connect to the database
	dsn := fmt.Sprintf("%s:%s@tcp(127.0.0.1:3306)/%s?charset=utf8mb4&parseTime=True&loc=Local", dbUser, dbPassword, database)
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to database: %s", err)
	}

	// Migrate the schema
	db.AutoMigrate(&Product{})

	// Batch insert records
	if numRecords > 0 {
		tx := db.Create(getProducts(numRecords))
		if tx.Error != nil {
			log.Fatalf("failed to insert records: %s", tx.Error)
		}
	}
}

func getProducts(n int) (products []Product) {
	for i := 0; i < n; i++ {
		products = append(products, Product{
			Code:  "hello",
			Price: uint(rand.Intn(100)),
		})
	}
	return
}
