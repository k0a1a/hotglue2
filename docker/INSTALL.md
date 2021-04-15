to put it up
 $ docker-compose up -d

run 
 $ docker-compose exec hotglue git clone https://github.com/k0a1a/hotglue2.git /app/
 $ docker-compose exec hotglue chmod -R 0777 /app/content
 $ docker-compose exec cp /app/user-config.inc.php-dist /app/user-config.inc.php
 $ docker-compose exec hotglue sed -i 's/changeme/myVeryComplexPassword/' /app/user-config.inc.php
