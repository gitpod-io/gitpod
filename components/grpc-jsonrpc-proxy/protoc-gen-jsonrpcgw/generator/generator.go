package generator

import (
	"bytes"
	"fmt"
	"strings"
	"text/template"

	"github.com/RussellLuo/protoc-go-plugins/base"
	"github.com/golang/protobuf/proto"
	google_protobuf "github.com/golang/protobuf/protoc-gen-go/descriptor"
	gen "github.com/golang/protobuf/protoc-gen-go/generator"
	plugin "github.com/golang/protobuf/protoc-gen-go/plugin"
)

// GatewayGenerator generates the JSON RPC gateway glue code
type GatewayGenerator struct {
	*base.Generator
}

// New produces a new generator
func New() *GatewayGenerator {
	return &GatewayGenerator{Generator: base.New()}
}

func findGatewayPackage(req *google_protobuf.FileDescriptorProto) string {
	// look for explicit option first
	var res string
	for _, o := range req.GetOptions().UninterpretedOption {
		if o.GetIdentifierValue() == "gateway_package" {
			res = string(o.GetStringValue())
		}
	}

	// use package instead
	if res == "" {
		res = req.GetPackage()
	}

	return res
}

func (g *GatewayGenerator) goFileName(protoName *string) string {
	return g.ProtoFileBaseName(*protoName) + ".jsonrpcgw.go"
}

func (g *GatewayGenerator) generatePackageName(protoFile *google_protobuf.FileDescriptorProto) {
	g.P("package " + findGatewayPackage(protoFile))
}

func (g *GatewayGenerator) generateImports(pbPkg string) {
	g.P(fmt.Sprintf(`
import (
	"fmt"

	"github.com/golang/protobuf/proto"
	context "golang.org/x/net/context"
	"google.golang.org/grpc"
	proxy "github.com/gitpod/gitpod-io/grpc-jsonrpc-proxy/pkg/proxy"

	pb "%s"
)`, pbPkg))
}

func (g *GatewayGenerator) generateService(fullServiceName, serviceName string, methods []*google_protobuf.MethodDescriptorProto) {
	g.genServiceStructure(serviceName)
	g.genServiceHandlerMapMethod(serviceName, methods)
	g.genServiceWrapperMethods(fullServiceName, serviceName, methods)
}

func (g *GatewayGenerator) genServiceStructure(serviceName string) {
	g.P()
	g.P("type ", serviceName, " struct {}")
}

func (g *GatewayGenerator) genServiceHandlerMapMethod(serviceName string, methods []*google_protobuf.MethodDescriptorProto) {
	receiverName := g.ReceiverName(serviceName)

	g.P()
	g.P("func (", receiverName, " *", serviceName, ") HandlerMap() map[string]proxy.MethodHandler {")
	g.In()
	g.P("m := make(map[string]proxy.MethodHandler)")

	for _, method := range methods {
		if method.GetClientStreaming() {
			continue
		}

		inputTypeName := g.TypeName(method.GetInputType())
		methodName := method.GetName()
		pattern := fmt.Sprintf("%s", strings.ToLower(methodName[0:1])+methodName[1:])

		if method.GetServerStreaming() {
			g.P(`m["`, pattern, `"] = `, "proxy.MakeStreamingHandler(", receiverName, ".", methodName, ", func() proto.Message { return new(pb.", inputTypeName, ") })")
			continue
		}

		g.P(`m["`, pattern, `"] = `, "proxy.MakeUnaryHandler(", receiverName, ".", methodName, ", func() proto.Message { return new(pb.", inputTypeName, ") })")
	}

	g.P("return m")
	g.Out()
	g.P("}")
}

func (g *GatewayGenerator) genServiceWrapperMethods(fullServiceName, serviceName string, methods []*google_protobuf.MethodDescriptorProto) {
	receiverName := g.ReceiverName(serviceName)

	for _, method := range methods {
		if method.GetClientStreaming() {
			continue
		}

		inputTypeName := "*pb." + g.TypeName(method.GetInputType())
		methodName := method.GetName()

		g.P()
		g.P("// ", methodName, " handles calls to ", serviceName, ".", methodName)
		if method.GetServerStreaming() {
			g.P("func (", receiverName, " *", serviceName, ") ", methodName, "(ctx context.Context, conn grpc.ClientConnInterface, in proto.Message, out func(proto.Message) error) error {")
			g.In()
			g.P("req, ok := in.(", inputTypeName, ")")
			g.P("if !ok {")
			g.In()
			g.P("return fmt.Errorf(\"input is not of type ", inputTypeName, "\")")
			g.Out()
			g.P("}")
			g.P()
			g.P("client := pb.New", serviceName, "Client(conn)")
			g.P("inc, err := client.", methodName, "(ctx, req)")
			g.P("if err != nil {")
			g.In()
			g.P("return err")
			g.Out()
			g.P("}")
			g.P("for {")
			g.In()
			g.P("msg, err := inc.Recv()")
			g.P("if err != nil {")
			g.In()
			g.P("return err")
			g.Out()
			g.P("}")
			g.P()
			g.P("err = out(msg)")
			g.P("if err != nil {")
			g.In()
			g.P("return err")
			g.Out()
			g.P("}")
			g.Out()
			g.P("}")
			g.Out()
			g.P("}")
			continue
		}

		g.P("func (", receiverName, " *", serviceName, ") ", methodName, "(ctx context.Context, conn grpc.ClientConnInterface, in proto.Message) (proto.Message, error) {")
		g.In()
		g.P("req, ok := in.(", inputTypeName, ")")
		g.P("if !ok {")
		g.In()
		g.P("return nil, fmt.Errorf(\"input is not of type ", inputTypeName, "\")")
		g.Out()
		g.P("}")
		g.P()
		g.P("client := pb.New", serviceName, "Client(conn)")
		g.P("return client.", methodName, "(ctx, req)")
		g.Out()
		g.P("}")
	}
}

func (g *GatewayGenerator) validateParameters() {
	if _, ok := g.Param["go_pkg"]; !ok {
		g.Fail("parameter `go_pkg` is required (e.g. --jsonrpcgw_out=go_pkg=<package>:<output path>)")
	}
}

func (g *GatewayGenerator) getFullServiceName(packageName, originalServiceName string) string {
	if packageName != "" {
		return packageName + "." + originalServiceName
	}
	return originalServiceName
}

func (g *GatewayGenerator) generateInit(srvs []*templateService) {
	tpl, err := template.New("tpl").Parse(`
func init() {
	{{- range $s := . }}
	proxy.RegisterService("{{ $s.Name }}", &{{ .ProxyService }}{})
	{{- end }}
}
`)
	if err != nil {
		g.Error(err)
	}
	buf := bytes.NewBuffer(nil)
	err = tpl.Execute(buf, srvs)
	if err != nil {
		g.Error(err)
	}

	g.P(buf.String())
}

// Make transforms a single file
func (g *GatewayGenerator) Make(protoFile *google_protobuf.FileDescriptorProto) (*plugin.CodeGeneratorResponse_File, error) {
	g.validateParameters()

	pbPkg := protoFile.Options.GetGoPackage()
	if p, ok := g.Param["pb_pkg_path"]; ok {
		pbPkg = p
	}

	var srvs []*templateService
	for _, s := range protoFile.Service {
		srv, err := g.transformService(s)
		if err != nil {
			g.Error(err)
		}

		srvs = append(srvs, srv)
	}

	g.generatePackageName(protoFile)
	g.generateImports(pbPkg)
	g.generateInit(srvs)

	packageName := protoFile.GetPackage()
	serviceNames := make([]string, len(protoFile.Service))
	for i, service := range protoFile.Service {
		fullServiceName := g.getFullServiceName(packageName, service.GetName())
		serviceNames[i] = gen.CamelCase(service.GetName())
		g.generateService(fullServiceName, serviceNames[i], service.Method)
	}

	file := &plugin.CodeGeneratorResponse_File{
		Name:    proto.String(g.goFileName(protoFile.Name)),
		Content: proto.String(g.String()),
	}
	return file, nil
}

// Generate is the main entrypoint for the generator
func (g *GatewayGenerator) Generate() {
	g.Generator.Generate(g)
}

type templateService struct {
	Name           string
	ProxyService   string
	GRPCClientName string
	Methods        []templateMethod
}

type templateMethod struct {
	Name            string
	ServerStreaming bool
	Input           string
	Output          string
}

func (g *GatewayGenerator) transformService(srv *google_protobuf.ServiceDescriptorProto) (*templateService, error) {
	var res templateService

	res.Name = srv.GetName()
	res.ProxyService = gen.CamelCase(srv.GetName())
	res.GRPCClientName = "pb." + gen.CamelCase(srv.GetName()) + "Client"
	for _, m := range srv.GetMethod() {
		if m.GetClientStreaming() {
			return nil, fmt.Errorf("%s.%s: client streaming is not supported", srv.GetName(), m.GetName())
		}

		res.Methods = append(res.Methods, templateMethod{
			Name:            m.GetName(),
			ServerStreaming: m.GetServerStreaming(),
			Input:           g.TypeName(m.GetInputType()),
			Output:          g.TypeName(m.GetOutputType()),
		})
	}

	return &res, nil
}
