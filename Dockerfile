FROM frekele/ant

# install environment dependencies
RUN apt-get update -yq \
    && apt-get install curl gnupg -yq \
    && curl -sL https://deb.nodesource.com/setup_8.x | bash \
    && apt-get install nodejs -yq \
    && apt-get install -y git \
    && npm i -g pm2

# prepare App Inventor workspace
RUN git clone https://github.com/mit-cml/appinventor-sources.git /usr/workspace \
    && cd /usr/workspace \
    && git submodule init \
    && git submodule update

WORKDIR /usr/src

# cache node modules
COPY package*.json ./
RUN npm i

COPY . .

EXPOSE 8048

CMD [ "npm", "start" ]