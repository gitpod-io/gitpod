module github.com/gitpod-io/gitpod/workspace-rollout-job

go 1.19

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-manager-bridge/api v0.0.0-00010101000000-000000000000
	github.com/spf13/cobra v1.4.0
	google.golang.org/grpc v1.49.0
)

require (
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/sirupsen/logrus v1.8.1 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	golang.org/x/net v0.0.0-20220225172249-27dd8689420f // indirect
	golang.org/x/sys v0.0.0-20220825204002-c680a09ffe64 // indirect
	golang.org/x/text v0.3.7 // indirect
	google.golang.org/genproto v0.0.0-20201019141844-1ed22bb0c154 // indirect
	google.golang.org/protobuf v1.28.1 // indirect
)

replace github.com/gitpod-io/gitpod/ws-manager-bridge/api => ../ws-manager-bridge-api/go // leeway

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway

replace k8s.io/api => k8s.io/api v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.24.4 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.24.4 // leeway indirect from components/common-go:lib
