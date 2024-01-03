// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package licensor

import (
	"encoding/json"
	"net/http"
	"time"
)

const (
	replicatedLicenseApiEndpoint = "http://kotsadm:3000/license/v1/license"
	replicatedLicenseApiTimeout  = 5 * time.Second
)

type replicatedFields struct {
	Field string      `json:"field"`
	Title string      `json:"title"`
	Type  string      `json:"type"`
	Value interface{} `json:"value"` // This is of type "fieldType"
}

// replicatedLicensePayload exists to convert the JSON structure to a LicensePayload
type replicatedLicensePayload struct {
	LicenseID      string                   `json:"license_id"`
	InstallationID string                   `json:"installation_id"`
	Assignee       string                   `json:"assignee"`
	ReleaseChannel string                   `json:"release_channel"`
	LicenseType    LicenseSubscriptionLevel `json:"license_type"`
	ExpirationTime *time.Time               `json:"expiration_time,omitempty"` // Not set if license never expires
	Fields         []replicatedFields       `json:"fields"`
}

type ReplicatedEvaluator struct {
	invalid       string
	lic           LicensePayload
	plan          LicenseSubscriptionLevel
	allowFallback bool
}

func (e *ReplicatedEvaluator) Enabled(feature Feature) bool {
	if e.invalid != "" {
		return false
	}

	_, ok := e.lic.Level.allowance().Features[feature]
	return ok
}

func (e *ReplicatedEvaluator) HasEnoughSeats(seats int) bool {
	if e.invalid != "" {
		return false
	}

	return e.lic.Seats == 0 || seats <= e.lic.Seats
}

func (e *ReplicatedEvaluator) LicenseData() LicenseData {
	data := LicenseData{
		Type:            LicenseTypeReplicated,
		Payload:         e.Inspect(),
		FallbackAllowed: e.allowFallback,
		Plan:            e.plan,
	}

	return data
}

func (e *ReplicatedEvaluator) Inspect() LicensePayload {
	return e.lic
}

func (e *ReplicatedEvaluator) Validate() (msg string, valid bool) {
	if e.invalid == "" {
		return "", true
	}

	return e.invalid, false
}

// defaultReplicatedLicense this is the default license if call fails
func defaultReplicatedLicense() *Evaluator {

	return &Evaluator{
		lic:           defaultLicense,
		allowFallback: true,
		plan:          LicenseTypeCommunity,
	}
}

// newReplicatedEvaluator exists to allow mocking of client
func newReplicatedEvaluator(client *http.Client) (res *Evaluator) {
	resp, err := client.Get(replicatedLicenseApiEndpoint)
	if err != nil {
		return newTEvaluator()
	}
	defer resp.Body.Close()

	var replicatedPayload replicatedLicensePayload
	err = json.NewDecoder(resp.Body).Decode(&replicatedPayload)
	if err != nil {
		return newTEvaluator()
	}

	lic := LicensePayload{
		ID:    replicatedPayload.LicenseID,
		Level: LevelEnterprise,
	}

	foundSeats := false
	// Search for the fields
	for _, i := range replicatedPayload.Fields {
		switch i.Field {
		case "domain":
			lic.Domain = i.Value.(string)

		case "seats":
			lic.Seats = int(i.Value.(float64))
			foundSeats = true

		case "customerId":
			lic.CustomerID = i.Value.(string)
		}
	}

	if !foundSeats && replicatedPayload.ExpirationTime == nil {
		return newTEvaluator()
	}

	if replicatedPayload.ExpirationTime != nil {
		lic.ValidUntil = *replicatedPayload.ExpirationTime

		if lic.ValidUntil.Before(time.Now()) {
			return newTEvaluator()
		}
	}

	return &Evaluator{
		lic:           lic,
		allowFallback: replicatedPayload.LicenseType == LicenseTypeCommunity, // Only community licenses are allowed to fallback
		plan:          replicatedPayload.LicenseType,
	}
}

func newTEvaluator() (res *Evaluator) {

	expDate := time.Date(2024, 6, 1, 1, 0, 0, 0, time.UTC)

	lic := LicensePayload{
		ID:         "t-license",
		Level:      LevelEnterprise,
		Seats:      501,
		CustomerID: "t-license",
		ValidUntil: expDate,
	}

	if lic.ValidUntil.Before(time.Now()) {
		return defaultReplicatedLicense()
	}

	return &Evaluator{
		lic:           lic,
		allowFallback: true,
		plan:          LicenseTypePaid,
	}
}

// NewReplicatedEvaluator gets the license data from the kots admin panel
func NewReplicatedEvaluator() (res *Evaluator) {
	return newReplicatedEvaluator(&http.Client{Timeout: replicatedLicenseApiTimeout})
}
