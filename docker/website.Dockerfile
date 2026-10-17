# Statische Produktwebsite (optional): docker compose --profile website up -d
ARG NGINX_IMAGE=nginx:1.27-alpine
FROM ${NGINX_IMAGE}
ARG APP_URL=http://localhost:8080
COPY apps/website /usr/share/nginx/html
COPY docker/nginx-website.conf /etc/nginx/nginx.conf
RUN rm -f /usr/share/nginx/html/preview-*.png /usr/share/nginx/html/README.md \
 && sed -i "s#const APP_URL = '/app/';#const APP_URL = '${APP_URL}';#" /usr/share/nginx/html/main.js \
 && sed -i "s#href=\"/app/\"#href=\"${APP_URL}\"#g" /usr/share/nginx/html/*.html \
 && chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx
USER nginx
EXPOSE 8080
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
