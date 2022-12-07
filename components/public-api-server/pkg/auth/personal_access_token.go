// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
)

const PersonalAccessTokenPrefix = "gitpod_pat_"

// PersonalAccessToken token is an Access Token for individuals. Any action taken with this token will act on behalf of the token creator.
// The PersonalAccessToken, in string form, takes the following shape: gitpod_pat_<signature>.<value>
// E.g. gitpod_pat_ko8KC1tJ-GkqIwqNliwF4tBUk2Jd5nEe9qOWqYfobtY.6ZDQVanpaTKj9hQuji0thCe8KFCcmEDGpsaTkSSb
type PersonalAccessToken struct {
	// prefix is the human readable prefix for the token used to identify which type of token it is,
	// but also for code-scanning of leaked credentials.
	// e.g. `gitpod_pat_`
	prefix string

	// value is the secret value of the token
	value string

	// signature is the generated signature of the value
	// signature is used to validate the personal access token before using it
	// signature is Base 64 URL Encoded, without padding
	signature string
}

func (t *PersonalAccessToken) String() string {
	return fmt.Sprintf("%s%s.%s", t.prefix, t.signature, t.value)
}

func (t *PersonalAccessToken) Value() string {
	return t.value
}

// ValueHash computes the SHA256 hash of the token value
func (t *PersonalAccessToken) ValueHash() string {
	hashed := sha256.Sum256([]byte(t.value))
	return hex.EncodeToString(hashed[:])
}

func GeneratePersonalAccessToken(signer Signer) (PersonalAccessToken, error) {
	if signer == nil {
		return PersonalAccessToken{}, errors.New("no personal access token signer available")
	}

	value, err := generateTokenValue(40)
	if err != nil {
		return PersonalAccessToken{}, fmt.Errorf("failed to generate personal access token value: %w", err)
	}

	signature, err := signer.Sign([]byte(value))
	if err != nil {
		return PersonalAccessToken{}, fmt.Errorf("failed to sign personal access token value: %w", err)
	}

	return PersonalAccessToken{
		prefix: PersonalAccessTokenPrefix,
		value:  value,
		// We use base64.RawURLEncoding because we do not want padding in the token in the form of '=' signs
		signature: base64.RawURLEncoding.EncodeToString(signature),
	}, nil
}

func ParsePersonalAccessToken(token string, signer Signer) (PersonalAccessToken, error) {
	if token == "" {
		return PersonalAccessToken{}, errors.New("empty personal access")
	}
	// Assume we start with the following token: gitpod_pat_ko8KC1tJ-GkqIwqNliwF4tBUk2Jd5nEe9qOWqYfobtY.6ZDQVanpaTKj9hQuji0thCe8KFCcmEDGpsaTkSSb
	// First, we identify if the token contains the required prefix
	if !strings.HasPrefix(token, PersonalAccessTokenPrefix) {
		return PersonalAccessToken{}, fmt.Errorf("personal access token does not have %s prefix", PersonalAccessTokenPrefix)
	}

	// Remove the gitpod_pat_ prefix
	token = strings.TrimPrefix(token, PersonalAccessTokenPrefix)

	// We now have the token in the following form:
	// ko8KC1tJ-GkqIwqNliwF4tBUk2Jd5nEe9qOWqYfobtY.6ZDQVanpaTKj9hQuji0thCe8KFCcmEDGpsaTkSSb
	// Break it into <signature>.<value>
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return PersonalAccessToken{}, errors.New("failed to break personal access token into signature and value")
	}

	// Sanity check the extracted values
	signature, value := parts[0], parts[1]
	if signature == "" {
		return PersonalAccessToken{}, errors.New("personal access token has empty signature")
	}
	if value == "" {
		return PersonalAccessToken{}, errors.New("personal access token has empty value")
	}

	// We must validate the signature before we proceed further.
	signatureForValue, err := signer.Sign([]byte(value))
	if err != nil {
		return PersonalAccessToken{}, fmt.Errorf("failed to compute signature of personal access token value: %w", err)
	}

	// The signature we receive is Base64 encoded, we also encode the signature for value we've just generated.
	encodedSignatureForValue := base64.RawURLEncoding.EncodeToString(signatureForValue)

	// Perform a cryptographically safe comparison between the signature, and the value we've just signed
	if subtle.ConstantTimeCompare([]byte(signature), []byte(encodedSignatureForValue)) != 1 {
		return PersonalAccessToken{}, errors.New("personal access token signature does not match token value")
	}

	return PersonalAccessToken{
		prefix:    PersonalAccessTokenPrefix,
		value:     value,
		signature: signature,
	}, nil
}

func generateTokenValue(size int) (string, error) {
	if size <= 0 {
		return "", errors.New("token size must be greater than 0")
	}

	// letters represent the resulting character-set of the token
	// we use only upper/lower alphanumberic to ensure the token is
	// * easy to select by double-clicking it
	// * URL safe
	const letters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	ret := make([]byte, size)
	for i := 0; i < size; i++ {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(letters))))
		if err != nil {
			return "", err
		}
		ret[i] = letters[num.Int64()]
	}

	return string(ret), nil
}
