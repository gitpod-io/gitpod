https://payment.{{.Domain}} {
    import enable_log
    import remove_server_header
    import ssl_configuration
    import debug_headers

    reverse_proxy {{.ReverseProxy}} {
        import upstream_headers
        import upstream_connection
    }

    handle_errors {
        respond "Internal Server Error" 500
    }
}