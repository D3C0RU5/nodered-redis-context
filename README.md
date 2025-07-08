# @d3c0ru5/nodered-redis-context

> A Redis-based context storage plugin for [Node-RED](https://nodered.org/).

This module enables you to persist Node-RED context variables (flow/global) in a Redis database, providing durability and support for distributed or multi-instance deployments.

---

## 📦 Installation

Install the package in your Node-RED environment:

```bash
npm install @d3c0ru5/nodered-redis-context
```

## ⚙️ Configuration

Add the following to your settings.js file in the Node-RED user directory:

```
contextStorage: {
  default: {
    module: "memory"
  },
  redis: {
    module: "@d3c0ru5/nodered-redis-context",
    config: {
      host: "127.0.0.1",
      port: 6379,
      db: 0,
      prefix: "nodered:",
      password: "your_optional_password"
    }
  }
}
```

Use the Redis context in your flows like this:

```
flow.set("x", 10, "redis");
await global.get("y", "redis");
```

## 🧪 Testing

To run automated tests with Redis via Docker:

```
npm test
```

This will:

- Spin up a Redis container with custom configuration
- Run tests using Mocha and Chai
- Automatically shut down the container after the test run

## 📁 Project Structure

```
.
├── index.js                # Entry point
├── lib/                    # Redis context store implementation
├── __tests__/              # Test files and docker-compose.yaml
├── package.json
└── README.md
```

## 👤 Author

Created by @d3c0ru5

## 🔗 References

- [Node-RED Context Docs](https://nodered.org/docs/user-guide/context)
- [Redis](https://redis.io/docs/latest/)
