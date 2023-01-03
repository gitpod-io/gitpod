// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package middleware

import (
	"bytes"
	"github.com/sirupsen/logrus"
	_ "github.com/sirupsen/logrus/hooks/test"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLoggingMiddleware(t *testing.T) {
	logInMemory := &bytes.Buffer{}
	logger := logrus.New()
	logger.SetOutput(logInMemory)
	logger.SetFormatter(&logrus.JSONFormatter{})

	expectedBody := `hello world`

	someHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(expectedBody))
	})
	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder() // this records the response

	m := NewLoggingMiddleware(logrus.NewEntry(logger))
	wrappedHandler := m(someHandler)
	wrappedHandler.ServeHTTP(rec, req)

	require.HTTPStatusCode(t, someHandler, http.MethodGet, "/", nil, http.StatusOK)
	require.HTTPBodyContains(t, someHandler, http.MethodGet, "/", nil, "hello")
}
