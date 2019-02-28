FROM frekele/ant

RUN apt-get update -yq \
    && apt-get install curl gnupg -yq \
    && curl -sL https://deb.nodesource.com/setup_8.x | bash \
    && apt-get install nodejs -yq \
    && apt-get install -y git

RUN npm i -g pm2 \
    && git clone https://github.com/mit-cml/appinventor-sources.git /usr/workspace \
    && cd /usr/workspace \
    && git submodule init \
    && git submodule update

WORKDIR /usr/src

COPY package*.json .
RUN npm i

COPY . .

EXPOSE 8048

CMD [ "npm", "start" ]