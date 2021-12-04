FROM debian:buster-slim
ENV DEBIAN_FRONTEND noninteractive
WORKDIR /app/

RUN apt clean all
RUN apt update
RUN apt -y install nginx php php-fpm php-mysql nano curl php-xml cron php-curl php-gd php-mbstring composer php-imagick git

COPY nginx.conf /etc/nginx/sites-available/
RUN ln -sf /etc/nginx/sites-available/nginx.conf /etc/nginx/sites-enabled/default

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]

