// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package registration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/kedge/pkg/kedge"
)

// This package takes are of cluster formation, i.e. registration and deregistration of workspace clusters on meta clusters.
// The process of a cluster A offering its services to cluster B works as follows:
//    1. kedge_a requests signup from kedge_b - if the signup completes, we'll return HTTP status 200m. If it fails the status code will be anything but 200 and the body details an error message as string
//    2. kedge_b collects and installs the services from kedge_a
//	  3. kedge_b informs all listeners about the new services being available
//	  4. kedge_b persists the info for the A cluster in its own Kubernetes s.t. upon restart that state remains available.
//    5. kedge_b will continue to list and install services from kedge_a - if collection fails for some time, cluster A is removed.

var (
	validNameRegexp   = regexp.MustCompile("^[a-z][a-z0-9-]{0,32}$")
	validSuffixRegexp = regexp.MustCompile("^[a-z][a-z0-9-]{0,6}$")
)

// Request is the structure we expect to receive when a cluster attempts to sign up
type Request struct {
	Name   string `json:"name"`
	Suffix string `json:"suffix"`
	URL    string `json:"url"`
	Token  string `json:"token"`
}

// Server serves an HTTP REST API which accepts registrations
type Server struct {
	OnNewCollector func(kedge.Collector) error
	Token          string
}

// Routes registers the server routes on an HTTP mux
func (srv *Server) Routes(mux *http.ServeMux) {
	mux.HandleFunc("/register", srv.handleRegistration)
}

// handleRegistration handles an incoming registration request from another cluster
func (srv *Server) handleRegistration(rw http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(rw, r.Method+" unsupported", http.StatusBadRequest)
		return
	}

	bearer := r.Header.Get("Authorization")
	if bearer != fmt.Sprintf("Bearer %s", srv.Token) {
		http.Error(rw, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req Request
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(rw, fmt.Sprintf("cannot decode request: %v", err), http.StatusPreconditionFailed)
		return
	}
	if !validNameRegexp.Match([]byte(req.Name)) {
		http.Error(rw, "name must match "+validNameRegexp.String(), http.StatusPreconditionFailed)
		return
	}
	if !validSuffixRegexp.Match([]byte(req.Suffix)) {
		http.Error(rw, "suffix must match "+validSuffixRegexp.String(), http.StatusPreconditionFailed)
		return
	}

	// At this point we have a valid, authenticated request - let's act on it.
	// First we try and collect information from the remote cluster - see if the URL and token were correct.
	_, err = kedge.Collect(req.URL, req.Token)
	if err != nil {
		http.Error(rw, fmt.Sprintf("cannot collect from remote kedge: %v", err), http.StatusPreconditionFailed)
		return
	}

	// Add to the store first, s.t. anyone else working with this store can start collecting
	collector := kedge.Collector{
		Name:   "dyn-" + req.Name,
		URL:    req.URL,
		Suffix: req.Suffix,
		Token:  req.Token,
	}
	if srv.OnNewCollector != nil {
		err = srv.OnNewCollector(collector)
		if err != nil {
			http.Error(rw, fmt.Sprintf("cannot complete registration: %v", err), http.StatusInternalServerError)
			return
		}
	}
	log.WithField("req", fmt.Sprintf("%+q", req)).Info("new collector registered")

	rw.WriteHeader(http.StatusOK)
	rw.Write([]byte("welcome"))
}
