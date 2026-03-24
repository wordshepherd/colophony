FROM prom/alertmanager:v0.28.1
USER root
COPY alertmanager.yml /etc/alertmanager/alertmanager.tmpl.yml
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
USER nobody
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["--config.file=/etc/alertmanager/alertmanager.yml", \
     "--storage.path=/alertmanager"]
