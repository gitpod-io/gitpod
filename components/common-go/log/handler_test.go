// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package log

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLevelHandler(t *testing.T) {
	tests := []struct {
		Name        string
		Method      string
		Body        []byte
		Expectation string
		Error       string
	}{
		{"report default level", http.MethodGet, nil, `{"level": "info"}`, ""},
		{"change level to info", http.MethodPost, []byte(`{"level": "info"}`), `{"level": "info"}`, ""},
		{"change level to debug", http.MethodPut, []byte(`{"level": "debug"}`), `{"level": "debug"}`, ""},
		{"invalid level", http.MethodPost, []byte(`{"level": "something invalid"}`), "", `not a valid logrus Level: "something invalid"`},
		{"invalid method", http.MethodDelete, nil, "", "DELETE unsupported"},
		{"empty body", http.MethodPost, []byte(""), "", "invalid request"},
		{"invalid json", http.MethodPost, []byte("{"), "", "cannot decode request: unexpected end of JSON input"},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			req, err := http.NewRequest(test.Method, "/debug/level", bytes.NewReader(test.Body))
			if err != nil {
				t.Fatal(err)
			}

			rr := httptest.NewRecorder()
			handler := http.HandlerFunc(LevelHandler)

			handler.ServeHTTP(rr, req)

			if test.Error == "" {
				if rr.Body.String() != test.Expectation {
					t.Errorf("handler returned unexpected body: got %v want %v", rr.Body.String(), test.Expectation)
				}

				return
			}

			if rr.Code == http.StatusOK {
				t.Errorf("handler returned should not return StatusOK")
				return
			}

			msg := strings.ReplaceAll(rr.Body.String(), "\n", "")
			if msg != test.Error {
				t.Errorf(`handler returned wrong error: got '%v' want '%v'`, msg, test.Error)
			}
		})
	}
}
