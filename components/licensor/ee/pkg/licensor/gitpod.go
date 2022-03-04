// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package licensor

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"
)

// GitpodEvaluator determines what a license allows for
type GitpodEvaluator struct {
	invalid string
	lic     LicensePayload
}

// Validate returns false if the license isn't valid and a message explaining why that is.
func (e *GitpodEvaluator) Validate() (msg string, valid bool) {
	if e.invalid == "" {
		return "", true
	}

	return e.invalid, false
}

// Enabled determines if a feature is enabled by the license
func (e *GitpodEvaluator) Enabled(feature Feature) bool {
	if e.invalid != "" {
		return false
	}

	_, ok := e.lic.Level.allowance().Features[feature]
	return ok
}

// HasEnoughSeats returns true if the license supports at least the give amount of seats
func (e *GitpodEvaluator) HasEnoughSeats(seats int) bool {
	if e.invalid != "" {
		return false
	}

	return e.lic.Seats == 0 || seats <= e.lic.Seats
}

// Inspect returns the license information this evaluator holds.
// This function is intended for transparency/debugging purposes only and must
// never be used to determine feature eligibility under a license. All code making
// those kinds of decisions must be part of the Evaluator.
func (e *GitpodEvaluator) Inspect() LicensePayload {
	return e.lic
}

// NewGitpodEvaluator produces a new license evaluator from a license key
func NewGitpodEvaluator(key []byte, domain string) (res *GitpodEvaluator) {
	if len(key) == 0 {
		// fallback to the default license
		return &GitpodEvaluator{
			lic: defaultLicense,
		}
	}

	deckey := make([]byte, base64.StdEncoding.DecodedLen(len(key)))
	n, err := base64.StdEncoding.Decode(deckey, key)
	if err != nil {
		return &GitpodEvaluator{invalid: fmt.Sprintf("cannot decode key: %q", err)}
	}
	deckey = deckey[:n]

	var lic licensePayload
	err = json.Unmarshal(deckey, &lic)
	if err != nil {
		return &GitpodEvaluator{invalid: fmt.Sprintf("cannot unmarshal key: %q", err)}
	}

	keyWoSig, err := json.Marshal(lic.LicensePayload)
	if err != nil {
		return &GitpodEvaluator{invalid: fmt.Sprintf("cannot remarshal key: %q", err)}
	}
	hashed := sha256.Sum256(keyWoSig)

	for _, k := range publicKeys {
		err = rsa.VerifyPKCS1v15(k, crypto.SHA256, hashed[:], lic.Signature)
		if err == nil {
			break
		}
	}
	if err != nil {
		return &GitpodEvaluator{invalid: fmt.Sprintf("cannot verify key: %q", err)}
	}

	if !matchesDomain(lic.Domain, domain) {
		return &GitpodEvaluator{invalid: "wrong domain"}
	}

	if lic.ValidUntil.Before(time.Now()) {
		return &GitpodEvaluator{invalid: "not valid anymore"}
	}

	return &GitpodEvaluator{
		lic: lic.LicensePayload,
	}
}
