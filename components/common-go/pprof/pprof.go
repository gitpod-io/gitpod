// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package pprof

import (
	"net/http"
	"net/http/pprof"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// Serve starts a new HTTP server serving pprof endpoints on the given addr
func Serve(addr string) {
	mux := http.NewServeMux()
	mux.HandleFunc("/debug/pprof/", index)
	mux.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	mux.HandleFunc("/debug/pprof/profile", pprof.Profile)
	mux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	mux.HandleFunc("/debug/pprof/trace", pprof.Trace)

	log.WithField("addr", addr).Info("serving pprof service")
	err := http.ListenAndServe(addr, mux)
	if err != nil {
		log.WithField("addr", addr).WithError(err).Warn("cannot serve pprof service")
	}
}

func index(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/debug/pprof/") {
		// according to Ian Lance Taylor it's ok to turn on mutex and block profiling
		// when asking for the actual profile [1]. This handler implements this idea, as
		// discussed in [2]
		//
		// [1] https://groups.google.com/forum/#!topic/golang-nuts/qiHa97XzeCw
		// [2] https://github.com/golang/go/issues/23401

		var (
			name          = strings.TrimPrefix(r.URL.Path, "/debug/pprof/")
			seconds, serr = strconv.ParseInt(r.URL.Query().Get("seconds"), 10, 64)
			frac, ferr    = strconv.ParseInt(r.URL.Query().Get("frac"), 10, 64)
		)
		if name == "mutex" {
			if serr == nil && ferr == nil && seconds > 0 && frac > 0 {
				runtime.SetMutexProfileFraction(int(frac))
				sleep(w, time.Duration(seconds)*time.Second)
				runtime.SetMutexProfileFraction(0)
			}
		}
	}

	pprof.Index(w, r)
}

func sleep(w http.ResponseWriter, d time.Duration) {
	var clientGone <-chan bool
	if cn, ok := w.(http.CloseNotifier); ok {
		clientGone = cn.CloseNotify()
	}
	select {
	case <-time.After(d):
	case <-clientGone:
	}
}
