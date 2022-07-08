FROM php:7.4-fpm
RUN apt-get update && apt-get install -y \
		libfreetype6-dev \
		libjpeg62-turbo-dev \
		libpng-dev \
	&& docker-php-ext-configure gd --with-freetype --with-jpeg \
	&& docker-php-ext-install -j$(nproc) gd
# RUN useradd --system hotglue2
# USER hotglue2
COPY . /hotglue2
WORKDIR /hotglue2
CMD [ "php-fpm", "-R", "-F"]