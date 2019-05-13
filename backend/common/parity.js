const axios = require('axios')
const Web3 = require('web3')
const Promise = require('bluebird')

const settings = require('./settings.js')
const errorHandler = require('../common/errorHandlers')

const parityUrl = "http://" + settings.ETHEROSCOPEPARITYMAINNET
const web3 = new Web3(new Web3.providers.HttpProvider(parityUrl))

module.exports = function (db, log) {
    let parity = {}

    web3.eth.net.isListening()
        .then(() => log.info('Successfully connected to parity, tried', parityUrl))
        .catch(() => {
            log.error('Please start parity, have tried:', parityUrl)
            process.exit(1)
        })

    /**
     * Function responsible for sending number of latest block in ethereum.
     *
     * @return {Promise<number>} number of latest block
     */
    parity.getLatestBlock = async function () {
        try {
            log.debug('parity.getLatestBlock')

            return await new Promise((resolve, reject) => {
                return web3.eth.getBlockNumber((err, block) => {
                    if (err) {
                        log.error('ERROR - parityGetLatestBlock', err)
                        return reject(err)
                    }
                    return resolve(block)
                })
            })
        } catch (err) {
            errorHandler.errorHandleThrow('parity.getLatestBlock', '')(err)
        }
    }

    /**
     * Function responsible for fetching contract's information from etherscan API.
     *
     * @param {string} address
     * @param {string} [network=mainnet] specifies ethereum's network we currently use
     *
     * @return {Promise<{contractName: String, ABI: Object}>} contract's instance
     */
    async function getContractInfoFromEtherscan(address, network = "mainnet") {
        let axiosGET = network === "mainnet" ? 'https://api' : `https://api-${network}`
        axiosGET += `.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${settings.server.etherscanAPIKey}`

        let response = await axios.get(axiosGET)
        let contractInstance = response.data.result[0]
        return { contractName: contractInstance.ContractName, ABI: JSON.parse(contractInstance.ABI) }
    }

    /**
     * Function responsible for generating contract's information and caching it in database.
     *
     * If information is already stored in database we simply take it from there.
     * Otherwise, we retrieve data from etherscan and cache it in database for future use.
     *
     * @param {string} address
     *
     * @return {Promise<{contractName: string, parsedContract: Object, parsedABI: Object}>}
     */
    parity.getContract = async function (address) {
        try {
            log.debug(`parity.getContract ${address}`)

            let contractFromDB = await db.getContract(address.substr(2))

            let parsedABI = contractFromDB === null ? null : contractFromDB.abi

            // this scenario happens "in" the main server
            if (parsedABI === null) {
                let contractInstance = await getContractInfoFromEtherscan(address)
                parsedABI = contractInstance.ABI
                let contractName = contractInstance.contractName
                contractFromDB = {
                    hash: address.substr(2),
                    name: contractName,
                    abi: JSON.stringify(parsedABI)
                };
                await db.addContract(contractFromDB)
            }

            parsedABI = JSON.parse(contractFromDB.abi)
            let contract = web3.eth.Contract(parsedABI, address)
            return {contractName: contractFromDB.name, parsedContract: contract, parsedABI: parsedABI}

        } catch (err) {
            errorHandler.errorHandleThrow(`parity.getContract ${address}`, '')(err)
        }
    }

    function isVariable(item) {
        return (item.outputs && item.outputs.length === 1 &&
            item.outputs[0].type.indexOf('uint') === 0 &&
            item.inputs.length === 0)
    }

    async function cacheContractVariables(address, parsedAbi) {
        let variableNames = []
        await Promise.each(parsedAbi, (item) => {
            if (isVariable(item)) variableNames.push(item.name)
        })

        let values = variableNames.map(variable => {
            //        UnitId:'NULL', bcs unused
            return {ContractHash: address, name: variable}
        })

        await db.addVariables(values)
    }

    parity.getContractVariables = async function (contractInfo) {
        let parsedContract = await contractInfo.parsedContract
        let address = await parsedContract.options.address.substr(2)
        let contractName = contractInfo.contractName
        let parsedAbi = contractInfo.parsedABI;

        let variables = await db.getVariables(address);
        if (variables.length === undefined || variables.length === 0) {
            await cacheContractVariables(address, parsedAbi)
            variables = await db.getVariables(address)
        }

        let variableNames = variables.map(variable => {
            return {variableName: variable.name, unit: null, description: null}
        })
        return {variables: variableNames, contractName: contractName}
    }

    /**
     * Function that computes value of given variable in a given block.
     *
     * @param {function} variableFunction
     * @param {number}   blockNumber
     * @return {Promise<number>} value of variable
     */
    async function valueAtBlock(variableFunction, blockNumber) {
        log.debug(`parity.valueAtBlock ${blockNumber}`)

        web3.eth.defaultBlock = '0x' + blockNumber.toString(16)
        let result = await variableFunction.call();
        return parseInt(result.valueOf())
    }

    /**
     * Function responsible for retrieving block's timestamp from ethereum
     *
     * @param {number} blockNumber
     *
     * @return {Promise<number>}
     */
    parity.calculateBlockTime = function (blockNumber) {
        log.debug(`parity.calculateBlockTime ${blockNumber}`)

        return new Promise((resolve, reject) => {
            return web3.eth.getBlock(blockNumber, (err, result) => {
                if (err) {
                    log.error(`ERROR - parity.calculateBlockTime ${blockNumber}`, err)
                    return reject(err)
                }
                return resolve(result.timestamp)
            })
        })
    }


    /**
     * Function responsible for generating timestamp of given block.
     *
     * First step is checking if timestamp is already in database, in this case we return stored timestamp.
     * Otherwise, we lock (in case of simultaneous action that put data in database just after we checked)
     * and check again, if it is in database. If not, we compute timestamp of block and put it into database.
     *
     * @param {Number} blockNumber
     *
     * @return {Promise<number>} timestamp of block
     */
    parity.getBlockTime = async function(blockNumber) {
        try {
            log.debug(`parity.getBlockTime ${blockNumber}`)

            let timeStamp = await db.getBlockTime(blockNumber)
            if (timeStamp !== null)
                return timeStamp
            timeStamp = await parity.calculateBlockTime(blockNumber)
            await db.addBlock({number: blockNumber, timeStamp: timeStamp})
            return timeStamp

        } catch (err) {
            errorHandler.errorHandleThrow(`parity.getBlockTime ${blockNumber}`, '')(err)
        }
    }

    /**
     * Function responsible for retrieving basic transaction information
     *
     * @param {String} transactionHash hash of contract transaction
     *
     * @return {Promise} transaction object
     */
    parity.getTransaction = async function (transactionHash) {
        return new Promise((resolve, reject) => {
            web3.eth.getTransaction(transactionHash, (err, res) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(res)
                }
            })
        })
    }

    /**
     * Function responsible for converting value of transaction to another unit.
     *
     * @param {number|BigNumber|string} value wei value of transaction
     * @param {string} unit one of the following: https://github.com/ethereum/wiki/wiki/JavaScript-API#web3fromwei
     *
     * @return {string|BigNumber} converted value
     */
    parity.convertValue = function (value, unit) {
        try {
            return web3.utils.fromWei(value, unit)
        } catch (err) {
            errorHandler.errorHandleThrow('ParityClient', 'Problem with converting transaction value')(err)
        }
    }

    /**
     * Function responsible for generating contract's events that occured in a given block range [startBlock, endBlock].
     *
     * @param {string} address
     * @param {Number} startBlock beginning od block frame
     * @param {Number} endBlock   end of block frame
     *
     * @return {Promise<any>} array of events
     */
    parity.getHistory = async function (address, startBlock, endBlock) {
        log.debug(`parity.getHistory ${address} ${startBlock} ${endBlock}`)

        return new Promise((resolve, reject) => {
            return web3.eth.getPastLogs({fromBlock: startBlock.toString(), toBlock: endBlock.toString(),
                address: address}, (err, res) => {
                if (err) {
                    log.error(`ERROR - parity.getHistory ${address} ${startBlock} ${endBlock}`)
                    return reject(err)
                }
                return resolve(res)
            })
        })
    }

    /**
     * Function responsible for processing events.
     *
     * Consists of 3 steps:
     * Step 1 - filtering events, so we have unique blocks' numbers (reduces amount of requests to parity)
     * Step 2 - converting event to tuple [timestamp_placeholder, value, blockNumber]
     * Step 3 - sorting elements (ascending by blockNumber)
     *
     * @param events         events to be processed
     * @param variableMethod
     * @return {Promise<Array>} array of tuples [timestamp_placeholder, value, blockNumber]
     */
    parity.processEvents = async function (events, variableMethod) {
        try {
            events = events.map(event => event.blockNumber.valueOf())
            events = events.filter((blockNumber, index, self) => self.indexOf(blockNumber) === index)

            events = await Promise.map(events, blockNumber => {
                return Promise.all(['timestamp_placeholder',
                    valueAtBlock(variableMethod, blockNumber), blockNumber])
            })

            events = events.sort((a, b) => a[2] - b[2])

            return events
        } catch (err) {
            errorHandler.errorHandleThrow(`parity.processHistory`, '')(err)
        }
    }

    /**
     * Main function responsible for generating data points for variable in block range [from, upTo]
     *
     * Consists of 3 steps:
     * Step 1 - generating all events in given range (parity.getHistory call)
     * Step 2 - calling parity.processEvents
     * Step 3 - adding timestamp value in place of placeholder
     *
     * @param {Object} contractInfo
     * @param {string} variableName
     * @param {Number} from           beginning of block frame
     * @param {Number} upTo           end of block frame
     *
     * @return {Promise<Array>} array of tuples [timeStamp, value, blockNumber]
     */
    parity.generateDataPoints = async function (contractInfo, variableName, from, upTo) {
        let address = contractInfo.parsedContract.options.address
        try {
            log.debug(`parity.generateDataPoints ${address} ${variableName} ${from} ${upTo}`)

            let events = await parity.getHistory(address, from, upTo)

            events = await parity.processEvents(events, contractInfo.parsedContract.methods[variableName])

            let results = []

            for (let event of events) {
                let blockTime = await parity.getBlockTime(event[2])
                results.push([blockTime, event[1], event[2]])
            }

            return results
        } catch (err) {
            errorHandler.errorHandleThrow(
                `parity.generateDataPoints ${address} ${variableName} ${from} ${upTo}`
                , '')(err)
        }
    }

    return parity
}

