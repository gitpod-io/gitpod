module github.com/gitpod-io/gitpod/workspacekit

go 1.18

replace github.com/seccomp/libseccomp-golang => github.com/gitpod-io/libseccomp-golang v0.9.2-0.20220701021458-9bf1c833815b

require (
	github.com/google/go-cmp v0.5.8
	github.com/moby/sys/mountinfo v0.6.1
	github.com/rootless-containers/rootlesskit v1.0.0
	github.com/seccomp/libseccomp-golang v0.9.2-0.20220502022130-f33da4d89646
	github.com/spf13/cobra v1.5.0
	golang.org/x/sys v0.0.0-20220728004956-3c1f35247d10
	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f
	google.golang.org/grpc v1.49.0
)

require gopkg.in/yaml.v3 v3.0.1 // indirect

require (
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/sirupsen/logrus v1.8.1 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	golang.org/x/net v0.0.0-20220909164309-bea034e7d591 // indirect
	golang.org/x/text v0.3.7 // indirect
	google.golang.org/genproto v0.0.0-20220915135415-7fd63a7952de // indirect
	google.golang.org/protobuf v1.28.1 // indirect
)
