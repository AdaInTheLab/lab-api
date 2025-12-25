#!/usr/bin/env bash
set -e

case "$1" in
  start)
    pm2 start ecosystem.config.cjs --env production
    ;;
  stop)
    pm2 stop lab-api
    ;;
  restart)
    pm2 restart lab-api
    ;;
  logs)
    pm2 logs lab-api
    ;;
  status)
    pm2 status
    ;;
  *)
    echo "Usage: lab-api {start|stop|restart|logs|status}"
    exit 1
    ;;
esac
