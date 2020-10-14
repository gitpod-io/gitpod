## Tips and Tricks

### Run unit tests
The unit tests in `pkg/sync` must be run as `root` because they create files with various permissions/ownership.
It's easiest to run them using `cd pkg/content && go test -c && sudo ./content.test -test.v`.
Once you have build the test executable using `go test -c`, you can also run specific test or even testcases.
To run a specific test use `sudo ./content.test -test.run TestName`, to run a specific testcase use `sudo ./content.test -test.run TestName -execute testcaseName`.

_Beware_: when running all testcases (i.e. without `-execute`) the test itself will spawn a child process to recover from the permission drop across test cases.
This also means that not all `-test.` flags will be passed on to the children. At the moment it's only `-test.v`.

### Tracing / Jaeger
`ws-daemon` has OpenTracing instrumentation which means you can get traces out of ws-daemon.
At the moment we just print the traces as log messages. If you want to run ws-daemon with a remote
Jaeger installation, you should set the following [environment variables](https://github.com/jaegertracing/jaeger-client-go#environment-variables):
```
# set the Jaeger endpoint (e.g. an all-in-binary)
JAEGER_ENDPOINT=http://localhost:14268/api/traces
# set the sampler to const, to get all traces
JAEGER_SAMPLER_TYPE=const
# enable the constant sampler
JAEGER_SAMPLER_PARAM=1
```