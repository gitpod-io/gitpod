package proxy

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/sourcegraph/jsonrpc2"
	rpcsocket "github.com/sourcegraph/jsonrpc2/websocket"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// Config configures the proxy
type Config struct {
	Endpoint string `json:"endpoint"`
}

// WebsocketProxy proxies JSON RPC over websocket requests
type WebsocketProxy struct {
	Config   Config
	Upgrader *websocket.Upgrader
}

// Serve serves the server
func (ws *WebsocketProxy) Serve(l net.Listener) error {
	return http.Serve(l, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		wsconn, err := ws.Upgrader.Upgrade(w, req, nil)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		rpcconn := jsonrpc2.NewConn(req.Context(), rpcsocket.NewObjectStream(wsconn), jsonrpc2.HandlerWithError(ws.handleRPCConn(req)))
		<-rpcconn.DisconnectNotify()
	}))
}

func (ws *WebsocketProxy) handleRPCConn(httpReq *http.Request) func(ctx context.Context, rpcconn *jsonrpc2.Conn, req *jsonrpc2.Request) (result interface{}, err error) {
	return func(ctx context.Context, rpcconn *jsonrpc2.Conn, req *jsonrpc2.Request) (result interface{}, err error) {
		conn, err := grpc.DialContext(ctx, ws.Config.Endpoint, grpc.WithInsecure())
		if err != nil {
			return nil, &jsonrpc2.Error{
				Code:    jsonrpc2.CodeInternalError,
				Message: "connect connect to endpoint",
			}
		}
		defer conn.Close()

		if req.Params == nil {
			return nil, &jsonrpc2.Error{
				Code:    jsonrpc2.CodeInvalidParams,
				Message: "params cannot be undefined",
			}
		}

		segs := strings.Split(req.Method, ".")
		if len(segs) != 2 {
			return nil, &jsonrpc2.Error{
				Code:    jsonrpc2.CodeInvalidRequest,
				Message: "method must have format: Service.Method",
			}
		}
		srvName, mtdName := segs[0], segs[1]

		srv, ok := _services[srvName]
		if !ok {
			return nil, &jsonrpc2.Error{
				Code:    jsonrpc2.CodeMethodNotFound,
				Message: fmt.Sprintf("unknown service \"%s\"", srvName),
			}
		}

		handler, ok := srv.HandlerMap()[mtdName]
		if !ok {
			return nil, &jsonrpc2.Error{
				Code:    jsonrpc2.CodeMethodNotFound,
				Message: fmt.Sprintf("unknown method \"%s.%s\"", srvName, mtdName),
			}
		}

		// ctx := metadata.AppendToOutgoingContext(ctx, )
		md := metadata.New(map[string]string{})
		for k, v := range httpReq.Header {
			md["HTTPHeader."+k] = v
		}
		for _, c := range httpReq.Cookies() {
			md["HTTPCookie"] = append(md["HTTPCookie"], c.String())
		}

		if handler.Stream != nil {
			// TODO: make this a proper JSON RPC error
			err = handler.Stream(ctx, conn, *req.Params, func(m json.RawMessage) error {
				return rpcconn.Notify(ctx, req.Method, m)
			})
			if err != nil {
				return nil, err
			}
			return nil, nil
		}
		if handler.Unary != nil {
			return handler.Unary(ctx, conn, *req.Params)
		}

		return nil, &jsonrpc2.Error{
			Code:    jsonrpc2.CodeMethodNotFound,
			Message: fmt.Sprintf("method has no handler"),
		}
	}
}
