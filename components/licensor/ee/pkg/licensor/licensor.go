// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package licensor

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

type LicenseType string

const (
	LicenseTypeGitpod     LicenseType = "gitpod"
	LicenseTypeReplicated LicenseType = "replicated"
)

// LicensePayload is the actual license content
type LicensePayload struct {
	ID         string       `json:"id"`
	Domain     string       `json:"domain"`
	Level      LicenseLevel `json:"level"`
	ValidUntil time.Time    `json:"validUntil"`

	// Seats == 0 means there's no seat limit
	Seats int `json:"seats"`
}

type licensePayload struct {
	LicensePayload
	Signature []byte `json:"signature"`
}

// LicenseLevel determine feature availability -
type LicenseLevel int

const (
	// LevelTeam is the default license level,
	// which is the free tier
	LevelTeam LicenseLevel = 0

	// LevelEnterprise enables enterprise features,
	// which applies after buying a license
	LevelEnterprise LicenseLevel = 1
)

// NamedLevel maps level names to the actual level
var NamedLevel map[string]LicenseLevel = map[string]LicenseLevel{
	"team":       LevelTeam,
	"enterprise": LevelEnterprise,
}

// Feature denotes a feature that can be enabled using a license key
type Feature string

const (
	// FeatureAdminDashboard enables the admin dashboard API
	FeatureAdminDashboard Feature = "admin-dashboard"
	// FeaturePrebuild enables prebuilds
	FeaturePrebuild Feature = "prebuild"
	// FeatureSetTimeout enables custom timeouts for workspaces
	FeatureSetTimeout Feature = "set-timeout"
	// FeatureSnapshot enables snapshot support
	FeatureSnapshot Feature = "snapshot"
	// FeatureWorkspaceSharing enables live workspace sharing
	FeatureWorkspaceSharing Feature = "workspace-sharing"
)

type featureSet map[Feature]struct{}

type allowance struct {
	Features featureSet

	// Total prebuild time that can be used at a certain level.
	// If zero the prebuild time is unlimited.
	PrebuildTime time.Duration
}

var allowanceMap = map[LicenseLevel]allowance{
	LevelTeam: {
		PrebuildTime: 50 * time.Hour,
		Features: featureSet{
			FeaturePrebuild: struct{}{},
		},
	},
	LevelEnterprise: {
		PrebuildTime: 0,
		Features: featureSet{
			FeaturePrebuild: struct{}{},

			FeatureAdminDashboard:   struct{}{},
			FeatureSetTimeout:       struct{}{},
			FeatureSnapshot:         struct{}{},
			FeatureWorkspaceSharing: struct{}{},
		},
	},
}

func (lvl LicenseLevel) allowance() allowance {
	a, ok := allowanceMap[lvl]
	if !ok {
		fmt.Fprintf(os.Stderr, "invalid license level %d - allowing nothing", lvl)
		return allowance{}
	}

	return a
}

var defaultLicense = LicensePayload{
	ID:    "default-license",
	Level: LevelTeam,
	Seats: 10,
	// Domain, ValidUntil are free for all
}

func matchesDomain(pattern, domain string) bool {
	if pattern == "" {
		return true
	}
	if domain == pattern {
		return true
	}

	if strings.HasPrefix(pattern, "*.") && len(pattern) > 2 {
		domainSuffix := pattern[1:]
		if strings.HasSuffix(domain, domainSuffix) {
			return true
		}
	}

	return false
}

type Evaluator interface {
	Enabled(feature Feature) bool
	HasEnoughSeats(seats int) bool
	Inspect() LicensePayload
	Validate() (msg string, valid bool)
}

// Sign signs a license so that it can be used with the evaluator
func Sign(l LicensePayload, priv *rsa.PrivateKey) (res []byte, err error) {
	rawl, err := json.Marshal(l)
	if err != nil {
		return nil, err
	}
	hashed := sha256.Sum256(rawl)

	sig, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, hashed[:])
	if err != nil {
		return nil, err
	}

	resl, err := json.Marshal(licensePayload{
		LicensePayload: l,
		Signature:      sig,
	})
	if err != nil {
		return nil, err
	}

	res = make([]byte, base64.StdEncoding.EncodedLen(len(resl)))
	base64.StdEncoding.Encode(res, resl)
	return res, nil
}
