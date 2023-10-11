// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package util

import (
	"errors"
	"fmt"
)

type ApplicationError interface {
	error

	// StatusCode returns the HTTP error code
	StatusCode() int

	Unwrap() error
}

func NewApplicationError(code int, msg string, err error) ApplicationError {
	return &applicationError{Code: code, Msg: fmt.Sprintf(msg+": %v", err)}
}

type applicationError struct {
	Msg   string `json:"message"`
	Code  int    `json:"code"`
	inner error  `json:"-"`
}

func (e *applicationError) StatusCode() int {
	return e.Code
}
func (e *applicationError) Error() string {
	return e.Msg
}
func (e *applicationError) Unwrap() error {
	return e.inner
}

var _ ApplicationError = &applicationError{}

func MapErrToHttpStatusCode(err error) int {
	var appErr ApplicationError
	if errors.As(err, &appErr) {
		return appErr.StatusCode()
	}

	return 500
}
