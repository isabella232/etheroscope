## Etheroscope
### An Ethereum-based smart contract visualiser
Etheroscope helps you monitor the state of smart contract variables over time.

### To install backend on Linux
```shell
cd dev-scripts
./installDependencies.sh
./setupDockerAndMysql.sh

# produce more data in blockchain
./syncFastBlockchain.sh
./syncFullBlockchain.sh
```

### To run this project on Linux
```shell
cd dev-scripts
./startRPCAPI.sh
./startMysql.sh
./startBackend.sh
./startFrontend.sh
go localhost:8090
```

### To install backend on Windows
install Node.js<br>
install Geth https://github.com/ethereum/go-ethereum/wiki/Building-Ethereum<br>
install Docker
```shell
npm install
cd dev-scripts
docker-compose up
# (if docker-compose up doesn`t work install MariaDB on docker in other way, then set ports)
node mysql-scripts setupNewDatabase.js

# produce more data in blockchain
geth --datadir ../geth-blockchains/fastRinkebyBlockchain console --rinkeby
geth --datadir ../geth-blockchains/fullRinkebyBlockchain console --rinkeby --gcmode archive
```

### To run this project on Windows
```shell
cd dev-scripts
docker-compose up # run your MariaDB on Docker
geth --datadir ../geth-blockchains/fastRinkebyBlockchain console --rinkeby --rpc --nodiscover
node ../server.js
node ../services/index.js
ng serve --port 8090 # alias ng="C:/Users/ja1/AppData/Roaming/npm/node_modules/@angular/cli/bin/ng"
go localhost:8090
```

### Own Etheroscope backend setup with MYSQL
###### Etheroscope needs Geth RPC API (WEB3) and database(LevelDB) with blockchain creted by Geth
You need to set your api connector and geth database path in `api/parity.js` file.
Geth database can be accessed only by one process,
so you can create to databases with blockchain one with `fast sync` for RPC API
and one with `archive sync` (`--gcmode archive`),
wich creates database for Eth-storage module (quick history searching).

###### Etheroscope needs MYSQL Database for storing app data.
You need to set your mysql connection in `db/db.js` file.

Best way to install MYSQL is to run Docker command `docker-compose up` in
folder with `.yml` file https://github.com/alice-si/etheroscope/blob/ZPP/dev-scripts/docker-compose.yml.

Then:<br>
Run `dev-srcipts/mysql-scripts/setupMysql.js` to setup new database ready for etheroscope.

Alternativley you can do the same using 3 scripts: <br>
You need to create database running `dev-scripts/mysql-scripts/createDatabase.js`.<br>
You need to create tables in your database running `dev-scripts/mysql-scripts/createTables.js`.<br>
Run second time `dev-scripts/mysql-scripts/createTables.js`.<br>
You need to addBlocks to your database running `dev-scripts/mysql-scripts/addBlocksWIthTimestamps.js`.<br>
(its not generating real timestamps for blocks but similar, like on Rinkeby)<br>
//TODO check if cacheBlocks.js works (if yes it is probably slow)
(You don`t need to add anything to 'contracts' table)

### Architecture diagram
![Etheroscope internal dependencies](https://raw.githubusercontent.com/Jab1one/materialy/master/architecture-diagrams/prostyrysunekarchitektury.jpg)

### Documentation 06.11.2018
```shell
.
./angular-cli.json
```
```shell
./api
./api/api.js            # handles requests
./api/parity.js         # functions for exploring blockchain
```
```shell
./blocknum
```
```shell
./contract_mappings
./contract_mappings/contracts.csv
```
```shell
./db
./db/cacheBlocks.js
./db/cacheBlocks.sh
./db/db.js              # functions for mysql database
```
```shell
./dev-scripts           # helpful scripts during development
./dev-scripts/docker-compose.yml                                 # docker config file
./dev-scripts/installDependencies.sh                             # installs dependencies on linux
./dev-scripts/mysql-scripts                                      # scripts for actions on mysql database
./dev-scripts/mysql-scripts/addBlocksWithTimestamps.js
./dev-scripts/mysql-scripts/createDatabase.js
./dev-scripts/mysql-scripts/createTables.js
./dev-scripts/mysql-scripts/dropTable.js
./dev-scripts/mysql-scripts/mysql-dbschema.ddl
./dev-scripts/mysql-scripts/setupNewDatabase.js                  # installs start content of database
./dev-scripts/mysql-scripts/showTables.js
./dev-scripts/mysql-scripts/testQuery.js
./dev-scripts/mysql-scripts/upadateBlockTimes.js
./dev-scripts/setupDockerAndMysql.sh                             # installs MariaDB (our mysql databas) and start content of db
./dev-scripts/startBackend.sh                                    # starts backend
./dev-scripts/startFrontend.sh                                   # starts frontend
./dev-scripts/startMysql.sh                                      # starts Mysql server MariaDB on Dockerbackend
./dev-scripts/startRPCAPI.sh                                     # starts Geth`s rpc API needed for backend
./dev-scripts/syncFastBlockchain.sh
./dev-scripts/syncFullBlockchain.sh
```
```shell
./e2e
./e2e/app.e2e-spec.ts
./e2e/app.po.ts
./e2e/tsconfig.json
```
```shell
./forever
./forever/deploy.json    # script for running aplication on server (version from branch MASTER)
```
```shell
./karma.conf.js
./LICENSE
./logo.png
./package.json
./protractor.config.js
./README.md              # readme with instructions
./server.js              # main server, handles http
```
```shell
./services
./services/index.js      # micro-service, generetes blockchain variable history, uses websocket
```
```shell
./spec
./spec/api
./spec/api/api_spec.js
./spec/api/parity_spec.js
./spec/support
./spec/support/jasmine.json
```
```shell
./src                    # Angular application frontend
./src/app
./src/app/app.component.html
./src/app/app.component.scss
./src/app/app.component.ts
./src/app/app.module.ts
./src/app/app.routing.ts
./src/app/explorer
./src/app/explorer/cards
./src/app/explorer/cards/cards.component.html
./src/app/explorer/cards/cards.component.scss
./src/app/explorer/cards/cards.component.ts
./src/app/explorer/contractHash.ts
./src/app/explorer/explorer.component.global.scss
./src/app/explorer/explorer.component.html
./src/app/explorer/explorer.component.scss
./src/app/explorer/explorer.component.ts
./src/app/explorer/graph
./src/app/explorer/graph/graph.component.html
./src/app/explorer/graph/graph.component.scss
./src/app/explorer/graph/graph.component.ts
./src/app/explorer/search
./src/app/explorer/search/search.component.html
./src/app/explorer/search/search.component.scss
./src/app/explorer/search/search.component.ts
./src/app/home
./src/app/home/home.component.html
./src/app/home/home.component.scss
./src/app/home/home.component.ts
./src/app/index.ts
./src/app/popular
./src/app/popular/popular.component.html
./src/app/popular/popular.component.scss
./src/app/popular/popular.component.ts
./src/app/_services
./src/app/_services/contract.service.ts
./src/app/_services/graph.service.ts
./src/environments
./src/environments/environment.prod.ts
./src/environments/environment.ts
./src/favicon.ico
./src/images
./src/images/clarity_logo.svg
./src/index.html
./src/main.ts
./src/polyfills.ts
./src/styles.css
./src/test.ts
./src/tsconfig.json
./src/typings.d.ts
```
```shell
./tslint.json
./typings.json
```
