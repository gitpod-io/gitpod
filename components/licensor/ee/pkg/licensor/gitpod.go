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

// NewGitpodEvaluator produces a new license evaluator from a license key
func NewGitpodEvaluator(key []byte, domain string) (res *Evaluator) {
	if len(key) == 0 {
		// fallback to the default license
		return &Evaluator{
			lic: defaultLicense,
		}
	}

	deckey := make([]byte, base64.StdEncoding.DecodedLen(len(key)))
	n, err := base64.StdEncoding.Decode(deckey, key)
	if err != nil {
		return &Evaluator{invalid: fmt.Sprintf("cannot decode key: %q", err)}
	}
	deckey = deckey[:n]

	var lic licensePayload
	err = json.Unmarshal(deckey, &lic)
	if err != nil {
		return &Evaluator{invalid: fmt.Sprintf("cannot unmarshal key: %q", err)}
	}

	keyWoSig, err := json.Marshal(lic.LicensePayload)
	if err != nil {
		return &Evaluator{invalid: fmt.Sprintf("cannot remarshal key: %q", err)}
	}
	hashed := sha256.Sum256(keyWoSig)

	for _, k := range publicKeys {
		err = rsa.VerifyPKCS1v15(k, crypto.SHA256, hashed[:], lic.Signature)
		if err == nil {
			break
		}
	}
	if err != nil {
		return &Evaluator{invalid: fmt.Sprintf("cannot verify key: %q", err)}
	}

	if !matchesDomain(lic.Domain, domain) {
		return &Evaluator{invalid: "wrong domain"}
	}

	if lic.ValidUntil.Before(time.Now()) {
		return &Evaluator{invalid: "not valid anymore"}
	}

	return &Evaluator{
		lic: lic.LicensePayload,
	}
}
