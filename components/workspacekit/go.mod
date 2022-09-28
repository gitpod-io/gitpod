module github.com/gitpod-io/gitpod/workspacekit

go 1.18

replace github.com/seccomp/libseccomp-golang => github.com/gitpod-io/libseccomp-golang v0.9.2-0.20220701021458-9bf1c833815b

require (
	github.com/google/go-cmp v0.5.8
	github.com/moby/sys/mountinfo v0.6.1
	github.com/rootless-containers/rootlesskit v1.0.1
	github.com/seccomp/libseccomp-golang v0.9.1
	github.com/spf13/cobra v1.5.0
	golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f
	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f
	google.golang.org/grpc v1.49.0
)

require (
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/sirupsen/logrus v1.9.0 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/stretchr/testify v1.7.2 // indirect
	golang.org/x/net v0.0.0-20220722155237-a158d28d115b // indirect
	golang.org/x/text v0.3.7 // indirect
	google.golang.org/genproto v0.0.0-20220628213854-d9e0b6570c03 // indirect
	google.golang.org/protobuf v1.28.1 // indirect
)
