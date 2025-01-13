# Why this package exists

The only reason this package exists is because libcontainer decided to privatize some functions we depend on: https://github.com/opencontainers/runc/commit/47e09976a3159a8e2bf6160e7e0aedcfeadb5cfe. Mostly - but not exclusively - for the fuse support.


When we upgraded, we had the option to a) drop support of the importing pieces, b) do a bigger rewrite or c) just internalize the code.

Source copied from: https://github.com/opencontainers/runc/blob/e0406b4ba62071d40f1eaa443945764e0ef56c41/libcontainer/cgroups/devices/devicefilter.go etc.


So if at some point we decide to get rid of the fuse support, it's worth checking what exactly we still need out of this.
