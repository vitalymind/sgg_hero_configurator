# SGG Hero Configurator project

This project contain two part (server + client) hero configurator app
Server meant to run as dockerized container, while client is bundled 
into static HTML.

# Explain how you would deploy the frontend
Client application, being bundled into static HTML/CSS/JS, can be hosted
on any CDN service, preferably one that only company employees have
access.

A configuration of ENV variable on CDN will be required to fetch
from actual server IP/domain, as Vite proxy only works in dev.
VITE_API_BASE_URL=https://backend-server.com

Also, server should be configured to allow CORS if it happen
to be running on domain other then client runs on.
ALLOWED_CORS_DOMAIN = ['http://localhost:5173', 'https://cdn-with-client-page.com']

# How to build for local development

## Reuqirements:
- Python
- Docker
- Nodejs v22.5 +

## Installation & start
Form root folder run `python start_dev_env.py`
