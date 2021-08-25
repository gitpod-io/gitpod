// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package main

import (
	"C"
	"encoding/json"
	"time"

	log "github.com/sirupsen/logrus"

	"github.com/gitpod-io/gitpod/licensor/ee/pkg/licensor"
)

var (
	instances map[int]*licensor.Evaluator = make(map[int]*licensor.Evaluator)
	nextID    int                         = 1
)

// Init initializes the global license evaluator from an environment variable
//export Init
func Init(key *C.char, domain *C.char) (id int) {
	id = nextID
	instances[id] = licensor.NewEvaluator([]byte(C.GoString(key)), C.GoString(domain))
	nextID++

	return id
}

// Validate returns false if the license isn't valid and a message explaining why that is.
//export Validate
func Validate(id int) (msg *C.char, valid bool) {
	e, ok := instances[id]
	if !ok {
		return C.CString("invalid instance ID"), false
	}

	gmsg, valid := e.Validate()
	return C.CString(gmsg), valid
}

// Enabled returns true if a license enables a feature
//export Enabled
func Enabled(id int, feature *C.char) (enabled, ok bool) {
	e, ok := instances[id]
	if !ok {
		return
	}

	return e.Enabled(licensor.Feature(C.GoString(feature))), true
}

// HasEnoughSeats returns true if the license supports at least the given number of seats.
//export HasEnoughSeats
func HasEnoughSeats(id int, seats int) (permitted, ok bool) {
	e, ok := instances[id]
	if !ok {
		return
	}

	return e.HasEnoughSeats(seats), true
}

// CanUsePrebuild returns true if the use a prebuild is permissible under the license,
// given the total prebuild time used already.
//export CanUsePrebuild
func CanUsePrebuild(id int, totalSecondsUsed int64) (permitted, ok bool) {
	e, ok := instances[id]
	if !ok {
		return
	}

	return e.CanUsePrebuild(time.Duration(totalSecondsUsed) * time.Second), true
}

// Inspect returns the license information this evaluator holds.
//export Inspect
func Inspect(id int) (lic *C.char, ok bool) {
	e, ok := instances[id]
	if !ok {
		return
	}

	b, err := json.Marshal(e.Inspect())
	if err != nil {
		log.WithError(err).Warn("Inspect(): cannot marshal license payload")
		return nil, false
	}

	return C.CString(string(b)), true
}

// Dispose removes/disposes an instance formerly created using Init. If the id does not exist, nothing happens.
//export Dispose
func Dispose(id int) {
	delete(instances, id)
}

// required to build
func main() {}
