// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	flag "github.com/spf13/pflag"
)

var (
	dbUser            string
	dbPass            string
	dbHost            string
	dbName            string
	command           string
	period            time.Duration
	timeout           time.Duration
	readyEndpointAddr string
)

func init() {
	flag.StringVar(&dbHost, "db-host", "db:3306", "database hostname")
	flag.StringVar(&dbName, "db-name", "gitpod", "database name")
	flag.StringVar(&dbUser, "db-user", "root", "database username")
	flag.StringVar(&dbPass, "db-pass", "test", "database password")
	flag.DurationVar(&timeout, "timeout", 4*time.Hour, "time until the dev-staging installation is removed - must be a valid duration")
	flag.DurationVar(&period, "period", 1*time.Minute, "time between activity checks - must be a valid duration")
	flag.StringVarP(&command, "command", "c", "echo time is up", "command to execute once we've timed out")
	flag.StringVar(&readyEndpointAddr, "ready-endpoint-addr", ":8080", "address where to serve the Kubernetes ready endpoint")
}

func main() {
	flag.Parse()
	log.Printf("sweeper started")

	db, err := sql.Open("mysql", fmt.Sprintf("%s:%s@tcp(%s)/%s", dbUser, dbPass, dbHost, dbName))
	if err != nil {
		log.Fatalf("cannot connect to DB: %+v", err)
		return
	}

	go func() {
		http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			fmt.Fprintf(w, "ready")
		})

		log.Printf("serving ready endpoint on %s", readyEndpointAddr)
		log.Fatal(http.ListenAndServe(readyEndpointAddr, nil))
	}()

	tick := time.NewTicker(period)
	for {
		t0 := getLastActivity(db)
		if t0 == nil {
			log.Fatalf("cannot determine last activity")
			return
		}
		dt := time.Since(*t0)
		log.Printf("last activity: %v (%s ago, %s until timeout)", t0.Format(time.RFC3339), dt.String(), (timeout - dt).String())

		if dt > timeout {
			log.Printf("timeout after %s, executing command: %s", dt.String(), command)

			segs := strings.Split(command, " ")
			cmd := exec.Command(segs[0], segs[1:]...)
			cmd.Env = os.Environ()
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			err = cmd.Run()
			if err != nil {
				log.Printf("cannot run command \"%s\": %+v", command, err)
			}
		}

		<-tick.C
	}
}

func getLastActivity(db *sql.DB) (lastActivity *time.Time) {
	log.Printf("attempting to determine last time of activity")

	srcs := []struct {
		Name   string
		Query  string
		Format string
	}{
		{"latest instance", "SELECT creationTime FROM d_b_workspace_instance ORDER BY creationTime DESC LIMIT 1", time.RFC3339},
		{"latest user", "SELECT creationDate FROM d_b_user ORDER BY creationDate DESC LIMIT 1", time.RFC3339},
		{"heartbeat", "SELECT lastSeen FROM d_b_workspace_instance_user ORDER BY lastSeen DESC LIMIT 1", "2006-01-02 15:04:05.999999"},
	}

	for _, src := range srcs {
		var rt string
		err := db.QueryRow(src.Query).Scan(&rt)
		if err != nil {
			log.Printf("cannot query %s: %+v", src.Name, err)
			continue
		}

		var t time.Time
		t, err = time.Parse(src.Format, rt)
		if err != nil {
			log.Printf("cannot parse %s: %+v", src.Name, err)
			continue
		}

		if lastActivity == nil || t.After(*lastActivity) {
			lastActivity = &t
		}
	}

	return lastActivity
}
