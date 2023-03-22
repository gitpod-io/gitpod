// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package extender

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/gorilla/mux"
	log "github.com/sirupsen/logrus"
	extender_v1 "k8s.io/kube-scheduler/extender/v1"
)

const (
	apiPrefix        = "/scheduler"
	predicatesPrefix = apiPrefix + "/predicates"
)

func predicateRoute(predicate Predicate) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var buf bytes.Buffer
		body := io.TeeReader(r.Body, &buf)
		log.WithField("predicate", predicate.Name).WithField("args", buf.String()).Info("predicate request")

		var extenderArgs extender_v1.ExtenderArgs
		var extenderFilterResult *extender_v1.ExtenderFilterResult

		err := json.NewDecoder(body).Decode(&extenderArgs)
		if err != nil {
			extenderFilterResult = &extender_v1.ExtenderFilterResult{
				Nodes:       nil,
				FailedNodes: nil,
				Error:       err.Error(),
			}
		} else {
			extenderFilterResult = predicate.Handler(extenderArgs)
		}

		log.WithField("predicate", predicate.Name).WithField("result", extenderFilterResult).Info("predicate result")
		response, _ := json.Marshal(extenderFilterResult)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(response)
	}
}

func AddPredicate(router *mux.Router, predicate Predicate) {
	path := predicatesPrefix + "/" + predicate.Name
	router.HandleFunc(path, predicateRoute(predicate)).Methods(http.MethodPost)
}
