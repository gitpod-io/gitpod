module github.com/gitpod-io/gitpod/image-builder

go 1.16

require (
	github.com/alecthomas/jsonschema v0.0.0-20190504002508-159cbd5dba26
	github.com/armon/circbuf v0.0.0-20190214190532-5111143e8da2
	github.com/cyphar/filepath-securejoin v0.2.2
	github.com/docker/cli v20.10.7+incompatible
	github.com/docker/distribution v2.7.1+incompatible
	github.com/docker/docker v20.10.7+incompatible
	github.com/docker/docker-credential-helpers v0.6.4 // indirect
	github.com/docker/go-connections v0.4.0 // indirect
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/content-service v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/image-builder/api v0.0.0-00010101000000-000000000000
	github.com/golang/mock v1.6.0
	github.com/gorilla/mux v1.8.0 // indirect
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0
	github.com/mattn/go-isatty v0.0.11
	github.com/morikuni/aec v1.0.0 // indirect
	github.com/opencontainers/go-digest v1.0.0
	github.com/opencontainers/image-spec v1.0.1
	github.com/opentracing/opentracing-go v1.2.0
	github.com/prometheus/client_golang v1.11.0
	github.com/sirupsen/logrus v1.8.1
	github.com/spf13/cobra v1.1.3
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	google.golang.org/grpc v1.39.0
	google.golang.org/protobuf v1.27.1
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway

replace github.com/gitpod-io/gitpod/content-service => ../content-service // leeway

replace github.com/gitpod-io/gitpod/content-service/api => ../content-service-api/go // leeway

replace github.com/gitpod-io/gitpod/image-builder/api => ../image-builder-api/go // leeway

replace k8s.io/api => k8s.io/api v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/component-helpers => k8s.io/component-helpers v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/controller-manager => k8s.io/controller-manager v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/kubectl => k8s.io/kubectl v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/mount-utils => k8s.io/mount-utils v0.21.1 // leeway indirect from components/common-go:lib
