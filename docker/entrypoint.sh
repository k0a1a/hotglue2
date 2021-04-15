#!/bin/bash
service nginx start
service php7.3-fpm start
sleep 2
tail -f /var/log/nginx/*.log
