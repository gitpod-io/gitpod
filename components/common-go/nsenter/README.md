## nsenter

### Credits

This package was taken from seccomp agent and adapted for the needs of workspacekit.

Source: https://github.com/kinvolk/seccompagent/blob/main/pkg/nsenter/README.md
Original Source: https://github.com/opencontainers/runc/blob/master/libcontainer/nsenter/README.md

### How does it work?

The `nsenter` package registers a special init constructor that is called before
the Go runtime has a chance to boot. This provides us the ability to `setns` on
existing namespaces and avoid the issues that the Go runtime has with multiple
threads. This constructor will be called if this package is registered,
imported, in your go application.

The `nsenter` package will `import "C"` and it uses [cgo](https://golang.org/cmd/cgo/)
package. In cgo, if the import of "C" is immediately preceded by a comment, that comment,
called the preamble, is used as a header when compiling the C parts of the package.
So every time we import package `nsenter`, the C code function `nsexec()` would be
called.

Because `nsexec()` must be run before the Go runtime in order to use the
Linux kernel namespace, you must `import` this library into a package if
you plan to use `libcontainer` directly. Otherwise Go will not execute
the `nsexec()` constructor, which means that the re-exec will not cause
the namespaces to be joined.
