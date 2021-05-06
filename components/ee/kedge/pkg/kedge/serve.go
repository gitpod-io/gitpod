// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package kedge

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/log"
	"k8s.io/client-go/kubernetes"
)

// EndpointServer serves kedge services for replication in another kubernetes cluster
type EndpointServer struct {
	Clientset kubernetes.Interface
	Port      uint16
	Services  []string
	Namespace string
	Token     string
}

// Routes registers the routes for this endpoint server on the server mux
func (srv *EndpointServer) Routes(mux *http.ServeMux) {
	mux.HandleFunc("/services", func(w http.ResponseWriter, r *http.Request) {
		bearer := r.Header.Get("Authorization")
		if bearer != fmt.Sprintf("Bearer %s", srv.Token) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		service, err := Discover(srv.Clientset, srv.Namespace, srv.Services)
		if err != nil {
			log.WithError(err).Warn("error while discovering services")
			http.Error(w, "unable to discover services", http.StatusInternalServerError)
			return
		}

		js, err := json.Marshal(service)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(js)
	})
}
