package baseserver

import "net/http"

var healthyResponse = []byte(`healthy`)

func ReadyHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(healthyResponse)
	})
}
