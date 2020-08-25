// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"flag"
	"net/http"
	"os"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/otiai10/copy"
)

var (
	port         = flag.String("p", "3000", "port to serve on")
	directory    = flag.String("d", ".", "the directory of static file to host")
	allowListing = flag.Bool("allow-listing", false, "allow directory listing")
	copyTo       = flag.String("copy-to", "", "copy the directory to another instead of serving using HTTP")
)

// FileSystem custom file system handler
type FileSystem struct {
	fs http.FileSystem
}

// Open opens file
func (fs FileSystem) Open(path string) (http.File, error) {
	f, err := fs.fs.Open(path)
	if err != nil {
		return nil, err
	}

	s, err := f.Stat()
	if err != nil {
		return nil, err
	}

	if s.IsDir() {
		// path points to a directory, which means we have to serve the index.html.
		// Go's default implementation of the http.FileSystem serves an index.html
		// if one is present, and all we'd have to do is to fail if there is none.
		index := strings.TrimSuffix(path, "/") + "/index.html"
		if _, err = fs.fs.Open(index); err != nil {
			return nil, err
		}
	}

	return f, nil
}

func main() {
	flag.Parse()

	if *copyTo != "" {
		log.WithField("source", *directory).WithField("dest", *copyTo).Info("copying theia")
		if _, err := os.Stat(*copyTo); err == nil {
			log.WithField("dest", *copyTo).Warn("destination exists already - doing nothing")
			return
		}

		err := copy.Copy(*directory, *copyTo)
		if err != nil {
			log.WithError(err).Fatal("cannot copy Theia")
		}
		log.WithField("source", *directory).WithField("dest", *copyTo).Info("copied theia")
		return
	}

	var fs http.FileSystem = http.Dir(*directory)
	if !*allowListing {
		log.Info("directory listing disabled")
		fs = FileSystem{fs}
	}

	http.Handle("/", http.FileServer(fs))

	log.WithField("directory", *directory).WithField("port", *port).Info("HTTP server running")
	log.Fatal(http.ListenAndServe(":"+*port, nil))
}
