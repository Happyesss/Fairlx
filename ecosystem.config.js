module.exports = {
  apps: [{
    name: "fairlx",
    script: "server.js",
    cwd: "/home/fairlx/myapp",
    instances: 6,
    exec_mode: "cluster",
    max_memory_restart: "1G",
    node_args: "--max-old-space-size=1024",
    env: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
};