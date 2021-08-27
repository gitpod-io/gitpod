module github.com/gitpod-io/gitpod/loadgen

go 1.17

require (
	github.com/cheggaaa/pb/v3 v3.0.5
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-manager/api v0.0.0-00010101000000-000000000000
	github.com/google/uuid v1.1.2
	github.com/sirupsen/logrus v1.8.1
	github.com/spf13/cobra v1.1.3
	google.golang.org/grpc v1.39.1
	google.golang.org/protobuf v1.27.1
	sigs.k8s.io/yaml v1.2.0
)

require (
	github.com/VividCortex/ewma v1.1.1 // indirect
	github.com/fatih/color v1.7.0 // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/mattn/go-colorable v0.1.2 // indirect
	github.com/mattn/go-isatty v0.0.12 // indirect
	github.com/mattn/go-runewidth v0.0.7 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.0.1 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	golang.org/x/net v0.0.0-20210520170846-37e1c6afe023 // indirect
	golang.org/x/sys v0.0.0-20210616094352-59db8d763f22 // indirect
	golang.org/x/text v0.3.6 // indirect
	google.golang.org/genproto v0.0.0-20201019141844-1ed22bb0c154 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
)

replace github.com/gitpod-io/gitpod/common-go => ../../components/common-go // leeway

replace github.com/gitpod-io/gitpod/content-service/api => ../../components/content-service-api/go // leeway

replace github.com/gitpod-io/gitpod/ws-manager/api => ../../components/ws-manager-api/go // leeway

replace k8s.io/api => k8s.io/api v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/component-helpers => k8s.io/component-helpers v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/controller-manager => k8s.io/controller-manager v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kubectl => k8s.io/kubectl v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/mount-utils => k8s.io/mount-utils v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/pod-security-admission => k8s.io/pod-security-admission v0.22.0 // leeway indirect from components/common-go:lib
