// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package util

import "sync/atomic"

// AtomicBool is an atomic boolean variable that can be used to synchronize Go routines
type AtomicBool int32

// Set changes the value of the variable
func (b *AtomicBool) Set(val bool) {
	var v int32
	if val {
		v = 1
	}
	atomic.StoreInt32((*int32)(b), v)
}

// Get retrieves an atomic value
func (b *AtomicBool) Get() bool {
	return atomic.LoadInt32((*int32)(b)) != 0
}

// Pass changes this variable to true and returns true iff this variable was false before. Returns false otherwise.
func (b *AtomicBool) Pass() bool {
	return atomic.CompareAndSwapInt32((*int32)(b), 0, 1)
}
