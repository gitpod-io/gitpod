// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"syscall"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/google/go-github/v39/github"
	flag "github.com/spf13/pflag"
	"golang.org/x/oauth2"
)

var (
	// activity check
	dbUser  string
	dbPass  string
	dbHost  string
	dbName  string
	timeout time.Duration

	// branch exists check
	owner           string
	repo            string
	branch          string
	tokenEnvVarName string

	// common
	command           string
	period            time.Duration
	readyEndpointAddr string
)

func init() {
	// activity check
	flag.StringVar(&dbHost, "db-host", "db:3306", "database hostname")
	flag.StringVar(&dbName, "db-name", "gitpod", "database name")
	flag.StringVar(&dbUser, "db-user", "root", "database username")
	flag.StringVar(&dbPass, "db-pass", "test", "database password")
	flag.DurationVar(&timeout, "timeout", 4*time.Hour, "time until the dev-staging installation is removed - must be a valid duration")

	// branch exists check
	flag.StringVar(&owner, "owner", "", "the owner of the repo this preview env is associated with")
	flag.StringVar(&repo, "repo", "", "the repo this preview env is associated with")
	flag.StringVar(&branch, "branch", "", "the branch this preview env is associated with")
	flag.StringVar(&tokenEnvVarName, "tokenEnvVarName", "", "the name of the environment variable containing the GH token")

	// common
	flag.DurationVar(&period, "period", 1*time.Minute, "time between checks - must be a valid duration")
	flag.StringVarP(&command, "command", "c", "echo time is up", "command to execute once we've timed out")
	flag.StringVar(&readyEndpointAddr, "ready-endpoint-addr", ":8080", "address where to serve the Kubernetes ready endpoint")
}

func main() {
	flag.Parse()
	log.Printf("sweeper started")

	go func() {
		http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			fmt.Fprintf(w, "ready")
		})

		log.Printf("serving ready endpoint on %s", readyEndpointAddr)
		log.Fatal(http.ListenAndServe(readyEndpointAddr, nil))
	}()

	// start checks
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if branch != "" {
		log.Printf("starting branch check")
		checkIfBranchExists(ctx)
	}

	log.Printf("starting activity check")
	go checkForRecentActivity(ctx)

	// shutdown
	termChan := make(chan os.Signal, 1)
	signal.Notify(termChan, syscall.SIGINT, syscall.SIGTERM)
	<-termChan

	log.Println("received signal, shutting down...")
	defer log.Println("shut down.")
}

func checkIfBranchExists(ctx context.Context) {
	if owner == "" || repo == "" || branch == "" {
		log.Fatalf("one of owner/repo/branch (%s/%s/%s) is not properly configured!", owner, repo, branch)
	}

	if tokenEnvVarName == "" {
		log.Fatal("tokenEnvVarName is not configured!")
	}
	token := os.Getenv(tokenEnvVarName)
	if token == "" {
		log.Fatalf("configured env var '%s' is empty!", tokenEnvVarName)
	}

	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: token},
	)
	tc := oauth2.NewClient(ctx, ts)
	client := github.NewClient(tc)

	tick := time.NewTicker(period)
	for {
		gone, err := fetchBranch(ctx, client)
		if err != nil {
			log.Printf("unable to fetch branch, skipping: %v\n", err)
		}
		if gone {
			log.Printf("branch %s in repo %s/%s is gone, executing command", branch, owner, repo)
			_ = execute(command)
		} else {
			log.Printf("branch %s in repo %s/%s still present", branch, owner, repo)
		}

		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

func fetchBranch(ctx context.Context, client *github.Client) (gone bool, err error) {
	_, resp, err := client.Repositories.GetBranch(ctx, owner, repo, branch, true)
	if resp != nil && resp.StatusCode == 404 {
		return true, nil
	}
	if err != nil {
		return false, err
	}

	return false, nil
}

func checkForRecentActivity(ctx context.Context) {
	db, err := sql.Open("mysql", fmt.Sprintf("%s:%s@tcp(%s)/%s", dbUser, dbPass, dbHost, dbName))
	if err != nil {
		log.Fatalf("cannot connect to DB: %+v", err)
		return
	}
	defer db.Close()

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
			_ = execute(command)
		}

		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
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

func execute(command string) error {
	segs := strings.Split(command, " ")
	cmd := exec.Command(segs[0], segs[1:]...)
	cmd.Env = os.Environ()
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		log.Printf("cannot run command \"%s\": %+v", command, err)
	}
	return err
}
