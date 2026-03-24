FROM prom/alertmanager:v0.28.1
# Install envsubst for config templating
USER root
RUN apk add --no-cache gettext
USER nobody
COPY alertmanager.yml /etc/alertmanager/alertmanager.tmpl.yml
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["--config.file=/etc/alertmanager/alertmanager.yml", \
     "--storage.path=/alertmanager"]
