# Proxy Daemon

## Start the Service

```bash
cargo run -- --port <command-listening-port>
```

The HTTP API service will run on the specified port to receive proxy management commands.

### API Endpoints

#### Start Proxy Forwarding

```http
POST /proxy/start
Content-Type: application/json

{
  "listen_port": 12345,
  "proxy_type": "http|https|socks5|socks5t",
  "proxy_host": "proxy server address",
  "proxy_port": "proxy server port",
  "username": "username (optional)",
  "password": "password (optional)"
}
```

#### Stop Proxy Forwarding

```http
POST /proxy/stop?port=<listen-port>
```

#### Check Running Status

```http
GET /proxy/list
```

## How It Works

1. Specify the management port when starting the program
2. Send a start command via HTTP API, specifying the listen port and target proxy server
3. The program creates a proxy server on the specified port to receive client connections
4. Transparently forward client traffic to the target proxy server
5. When sending a stop command, close the corresponding proxy forwarding instance

## Notes

- Ensure the specified port is not already in use
- Supported proxy types: `http`, `https`, `socks5`, `socks5t`
- Username and password are optional fields, fill them based on the proxy service provider's requirements
