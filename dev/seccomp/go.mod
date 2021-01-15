module seccomp

go 1.15

replace github.com/seccomp/libseccomp-golang => github.com/kinvolk/libseccomp-golang v0.9.2-0.20201113182948-883917843313

require (
	github.com/kr/pretty v0.1.0 // indirect
	github.com/seccomp/libseccomp-golang v0.9.1
	github.com/sirupsen/logrus v1.7.0
	github.com/stretchr/testify v1.4.0 // indirect
	golang.org/x/sys v0.0.0-20210113181707-4bcb84eeeb78
	gopkg.in/check.v1 v1.0.0-20180628173108-788fd7840127 // indirect
	gopkg.in/yaml.v2 v2.2.8 // indirect
)
