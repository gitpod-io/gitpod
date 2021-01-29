//
// Copyright The runc authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// +build linux,gccgo

package nsenter

/*
#cgo CFLAGS: -Wall
extern void nsexec();
void __attribute__((constructor)) init(void) {
	nsexec();
}
*/
import "C"

// AlwaysFalse is here to stay false
// (and be exported so the compiler doesn't optimize out its reference)
var AlwaysFalse bool

func init() {
	if AlwaysFalse {
		// by referencing this C init() in a noop test, it will ensure the compiler
		// links in the C function.
		// https://gcc.gnu.org/bugzilla/show_bug.cgi?id=65134
		C.init()
	}
}
