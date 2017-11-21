const axios = require('axios')
const Web3 = require('web3')
var Promise = require('bluebird')

const parityUrl = 'http://localhost:8545'
const web3 = new Web3(new Web3.providers.HttpProvider(parityUrl))

module.exports = function (db, log, validator) {
  const parity = {}

  parity.getLatestBlock = function () {
    return new Promise((resolve, reject) => {
      return web3.eth.getBlockNumber((error, block) => {
        if (error) {
          log.error('Error getting block number' + error)
        }
        return resolve(block)
      })
    })
  }

  parity.getContract = function (address) {
    return new Promise((resolve, reject) => {
      db.getContract(address.substr(2))
      .then((result) => {
        if (result.parsedContract === null) {
          const axiosGET = 'https://api.etherscan.io/api?module=contract&action=getabi&address=' // Get ABI
          const axiosAPI = '&apikey=RVDWXC49N3E3RHS6BX77Y24F6DFA8YTK23'
          return axios.get(axiosGET + address + axiosAPI)
            .then((res) => {
              let parsedContract = parity.parseContract(res.data.result, address)
              // Add the parsed contract to the database, assuming it is already in there (with a name)
              db.updateContractWithABI(address.substr(2), parsedContract)
                .catch((err) => {
                  log.error('parity.js: Error adding contract abi to the db')
                  log.error(err)
                })
              return resolve({ parsedContract: parsedContract, contractName: result })
            })
            .catch((err) => {
              log.error('parity.js: Etherscan.io API error: ' + err)
              return reject(err)
            })
        }
        return resolve(result)
      })
    })
  }

  // Obtaining Contract information from ABI and address
  parity.parseContract = function (desc, address) {
    var contractABI = JSON.parse(desc)
    var Contract = web3.eth.contract(contractABI)
    return Contract.at(address)
  }

  parity.getContractVariables = function (contractInfo) {
    let parsedContract = contractInfo.parsedContract
    let contractName = contractInfo.contractName
    return new Promise((resolve, reject) => {
      let address = parsedContract.address.substr(2)
      db.getVariables(address).then((res) => {
        if (res.recordset.length === 0) {
          log.debug('parity.js: Caching variables for contract')
          var abi = parsedContract.abi
          let variableNames = []
          return Promise.each(abi, (item) => {
            if (item.outputs && item.outputs.length === 1 &&
              item.outputs[0].type.indexOf('uint') === 0 &&
              item.inputs.length === 0) {
              variableNames.push(item.name)
            }
          })
            .then((results) => {
              return Promise.each(variableNames, (variableName) => {
                db.addVariable([[address, variableName]], (err, res) => {
                  if (err) log.error('Error with caching variables: ' + err)
                })
              })
            })
            .then((results) => {
              return resolve({ variableNames: variableNames, contractName: contractName })
            })
        } else {
          let variableNames = []
          Promise.map(res.recordset, (elem) => {
            variableNames.push(elem.variableName)
          }).then(() => {
            return resolve({ variableNames: variableNames, contractName: contractName })
          })
        }
      })
    })
  }

  // Query value of variable at certain block
  parity.queryAtBlock = function (query, block) {
    let hex = '0x' + block.toString(16)
    web3.eth.defaultBlock = hex
    return new Promise((resolve, reject) => {
      return query((err, result) => {
        return (err ? reject(err) : resolve(parseInt(result.valueOf())))
      })
    })
  }

  parity.calculateBlockTime = function (blockNumber) {
    return new Promise((resolve) => {
      let time = web3.eth.getBlock(blockNumber).timestamp
      return resolve(time)
    })
  }

  parity.getBlockTime = function (blockNumber) {
    return new Promise((resolve) => {
      db.getBlockTime(blockNumber)
        .then((result) => {
          if (result.recordset.length !== 0) {
            return resolve(result.recordset[0].timeStamp)
          }
          return this.calculateBlockTime(blockNumber).then((time) => {
            db.addBlockTime([[blockNumber, time, 1]])
            return resolve(time)
          })
        })
    })
  }

  parity.getHistory = function (address, method, startBlock, endBlock, totalFrom, totalTo) {
    let filter = web3.eth.filter({fromBlock: startBlock, toBlock: endBlock, address: address})
    return new Promise((resolve, reject) => {
      filter.get((error, result) => {
        if (!error) {
          log.debug('parity.js: Fetched all transactions of sent or sent to ' + address + 'of size ' + result.length)
          log.debug('parity.js: From', startBlock, 'to', endBlock)
          db.updateFromTo(address.substr(2), method, totalFrom, totalTo)
            .then(() => {
              log.debug('parity.js: Updating cached address')
              return resolve(result)
            })
            .catch((err) => {
              log.error('parity.js: db update error: ', err)
              return reject(err)
            })
        } else {
          return reject(error)
        }
      })
    })
  }

  parity.generateDataPoints = function (eventsA, contract, method, from, to,
    totalFrom, totalTo) {
    let prevTime = 0
    return new Promise((resolve, reject) => {
      log.debug('Generating data points')
      Promise.map(eventsA, (event) => {
        // [(t,v,b)]
        return Promise.all([parity.getBlockTime(event.blockNumber.valueOf()),
          parity.queryAtBlock(contract[method], event.blockNumber.valueOf()), event.blockNumber.valueOf()])
      })
      .then((events) => {
        return Promise.filter(events, ([time, val, blockNum]) => {
          let updates = time !== prevTime
          if (updates) {
            prevTime = time
            db.addDataPoints([[contract.address.substr(2), method, blockNum, val]])
          }
          return updates
        })
      })
      .then((events) => {
        resolve(events.sort((a, b) => {
          return a[0] - b[0]
        }))
      })
      .catch((err) => {
        log.error('Data set generation error: ' + err)
        return reject(err)
      })
    })
  }

  return parity
}
