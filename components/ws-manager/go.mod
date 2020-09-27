module github.com/gitpod-io/gitpod/ws-manager

go 1.14

require (
	github.com/alecthomas/jsonschema v0.0.0-20190504002508-159cbd5dba26
	github.com/alecthomas/repr v0.0.0-20200325044227-4184120f674c
	github.com/asaskevich/govalidator v0.0.0-20200428143746-21a406dcc535 // indirect
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/content-service v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/registry-facade/api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-manager/api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-sync/api v0.0.0-00010101000000-000000000000
	github.com/go-ozzo/ozzo-validation v3.5.0+incompatible
	github.com/golang/mock v1.4.4
	github.com/golang/protobuf v1.4.2
	github.com/google/uuid v1.1.1
	github.com/grpc-ecosystem/go-grpc-middleware v1.0.1-0.20190118093823-f849b5445de4
	github.com/imdario/mergo v0.3.8
	github.com/minio/minio-go/v6 v6.0.56 // indirect
	github.com/opentracing/opentracing-go v1.1.0
	github.com/prometheus/client_golang v1.1.0
	github.com/sirupsen/logrus v1.5.0
	github.com/spf13/afero v1.2.2
	github.com/spf13/cobra v0.0.5
	golang.org/x/sync v0.0.0-20200625203802-6e8e738ad208
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	google.golang.org/grpc v1.32.0
	k8s.io/api v0.0.0-20191112020540-7f9008e52f64
	k8s.io/apimachinery v0.0.0
	k8s.io/client-go v0.0.0
	sigs.k8s.io/yaml v1.1.0
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway

replace github.com/gitpod-io/gitpod/content-service => ../content-service // leeway

replace github.com/gitpod-io/gitpod/content-service/api => ../content-service-api/go // leeway

replace github.com/gitpod-io/gitpod/registry-facade/api => ../registry-facade-api/go // leeway

replace github.com/gitpod-io/gitpod/ws-manager/api => ../ws-manager-api/go // leeway

replace github.com/gitpod-io/gitpod/ws-sync/api => ../ws-sync-api/go // leeway

replace k8s.io/api => k8s.io/api v0.0.0-20190620084959-7cf5895f2711 // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.0.0-20190620085554-14e95df34f1f // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.0.0-20190612205821-1799e75a0719 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.0.0-20190620085212-47dc9a115b18 // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.0.0-20190620085706-2090e6d8f84c // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.0.0-20190620085101-78d2af792bab // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.0.0-20190620090043-8301c0bda1f0 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.0.0-20190620090013-c9a0fc045dc1 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.15.12-beta.0 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.0.0-20190620085130-185d68e6e6ea // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.0.0-20190531030430-6117653b35f1 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.0.0-20190620090116-299a7b270edc // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.0.0-20190620085325-f29e2b4a4f84 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.0.0-20190620085942-b7f18460b210 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.0.0-20190620085809-589f994ddf7f // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.0.0-20190620085912-4acac5405ec6 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.0.0-20190620085838-f1cb295a73c9 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.0.0-20190620090156-2138f2c9de18 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.0.0-20190620085625-3b22d835f165 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.0.0-20190620085408-1aef9010884e // leeway indirect from components/common-go:lib
