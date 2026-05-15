module.exports = {
  apps: [{
    name: 'pacman-game',
    script: 'npm',
    args: 'start -- -p 3055',
    cwd: '/home/gelt/apps/pacman-game',
    env: {
      NODE_ENV: 'production',
      PORT: 3055,
    },
  }],
}
