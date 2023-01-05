// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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

// LicenseSubscriptionLevel is initialized to have a standard license plan
// between replicated and gitpod licenses
type LicenseSubscriptionLevel string

const (
	LicenseTypeCommunity   LicenseSubscriptionLevel = "community"
	LicenseTypePaid        LicenseSubscriptionLevel = "prod"
	LicenseTypeTrial       LicenseSubscriptionLevel = "trial"
	LicenseTypeDevelopment LicenseSubscriptionLevel = "dev"
)

// LicenseData has type specific info about the license
type LicenseData struct {
	Type            LicenseType              `json:"type"`
	Payload         LicensePayload           `json:"payload"`
	Plan            LicenseSubscriptionLevel `json:"plan"`
	FallbackAllowed bool                     `json:"fallbackAllowed"`
}

// LicensePayload is the actual license content
type LicensePayload struct {
	ID         string       `json:"id"`
	Domain     string       `json:"domain"`
	Level      LicenseLevel `json:"level"`
	ValidUntil time.Time    `json:"validUntil"`
	// Type       LicenseType  `json:"type"`

	// Seats == 0 means there's no seat limit
	Seats int `json:"seats"`

	// CustomerID is used to identify installations in installation analytics
	CustomerID string `json:"customerID,omitempty"`
}

type licensePayload struct {
	LicensePayload
	Signature []byte `json:"signature"`
}

// LicenseLevel determine feature availability -
type LicenseLevel int

const (
	// This exists for historical reasons - it is now the same as LevelEnterprise
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
		Features: featureSet{
			FeatureAdminDashboard: struct{}{},
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

// Fallback license is used when the instance exceeds the number of licenses - it allows limited access
var fallbackLicense = LicensePayload{
	ID:    "fallback-license",
	Level: LevelEnterprise,
	Seats: 0,
	// Domain, ValidUntil are free for all
}

// Default license is used when no valid license is given - it allows full access up to 10 users
var defaultLicense = LicensePayload{
	ID:    "default-license",
	Level: LevelEnterprise,
	Seats: 0,
	// Domain, ValidUntil are free for all
}

// we match domains only for `gitpod` license and not with replicated license.
// In the case of replicated this ensures faster client onboarding
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

// Evaluator determines what a license allows for
type Evaluator struct {
	invalid       string
	allowFallback bool // Paid licenses cannot fallback and prevent additional signups
	lic           LicensePayload
	plan          LicenseSubscriptionLevel // Specifies if it is a community/free plan or paid plan
}

// Validate returns false if the license isn't valid and a message explaining why that is.
func (e *Evaluator) Validate() (msg string, valid bool) {
	if e.invalid == "" {
		return "", true
	}

	return e.invalid, false
}

// Enabled determines if a feature is enabled by the license
func (e *Evaluator) Enabled(feature Feature, seats int) bool {
	if e.invalid != "" {
		return false
	}

	var ok bool
	if e.hasEnoughSeats(seats) {
		// License has enough seats available - evaluate this license
		_, ok = e.lic.Level.allowance().Features[feature]
	} else if e.allowFallback {
		// License has run out of seats - use the fallback license
		_, ok = fallbackLicense.Level.allowance().Features[feature]
	}

	return ok
}

// hasEnoughSeats returns true if the license supports at least the give amount of seats
func (e *Evaluator) hasEnoughSeats(seats int) bool {
	if e.invalid != "" {
		return false
	}

	return e.lic.Seats == 0 || seats <= e.lic.Seats
}

// HasEnoughSeats is the public method to hasEnoughSeats. Will use fallback license if allowable
func (e *Evaluator) HasEnoughSeats(seats int) bool {
	if e.invalid != "" {
		return false
	}

	if !e.allowFallback {
		return e.hasEnoughSeats(seats)
	}
	// There is always more space if can use a fallback license
	return true
}

// Inspect returns the license information this evaluator holds.
// This function is intended for transparency/debugging purposes only and must
// never be used to determine feature eligibility under a license. All code making
// those kinds of decisions must be part of the Evaluator.
func (e *Evaluator) Inspect() LicensePayload {
	return e.lic
}

func (e *Evaluator) LicenseData() LicenseData {
	data := LicenseData{
		Type:            LicenseType(e.GetLicenseType()),
		Payload:         e.Inspect(),
		FallbackAllowed: e.allowFallback,
		Plan:            e.plan,
	}

	return data
}

func (e *Evaluator) GetLicenseType() string {
	return os.Getenv("GITPOD_LICENSE_TYPE")
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
