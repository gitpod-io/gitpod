https://payment.{{.Domain}} {
    import enable_log
    import remove_server_header
    import ssl_configuration
    import debug_headers

    reverse_proxy {{.ReverseProxy}} {
        import upstream_connection
    }

    @backend path /stripe/invoices/webhook
    handle @backend {
        reverse_proxy public-api-server.{$KUBE_NAMESPACE}.{$KUBE_DOMAIN}:9002 {
            import upstream_connection
        }
    }

    handle_errors {
        respond "Internal Server Error" 500
    }
}
