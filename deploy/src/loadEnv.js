const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
})
const { isAddress, toBN } = require('web3').utils
const envalid = require('envalid')
const { ZERO_ADDRESS } = require('./constants')

// Validations and constants
const validBridgeModes = ['NATIVE_TO_ERC', 'ERC_TO_ERC', 'ERC_TO_NATIVE', 'ERC_TO_ERC_MULTIPLE']
const bigNumValidator = envalid.makeValidator(x => toBN(x))
const validateAddress = address => {
  if (isAddress(address)) {
    return address
  }

  throw new Error(`Invalid address: ${address}`)
}
const addressValidator = envalid.makeValidator(validateAddress)
const addressesValidator = envalid.makeValidator(addresses => {
  addresses.split(' ').forEach(validateAddress)
  return addresses
})

const { BRIDGE_MODE } = process.env

if (!validBridgeModes.includes(BRIDGE_MODE)) {
  throw new Error(`Invalid bridge mode: ${BRIDGE_MODE}`)
}

let validations = {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY: envalid.str(),
  DEPLOYMENT_GAS_LIMIT: bigNumValidator(),
  HOME_DEPLOYMENT_GAS_PRICE: bigNumValidator(),
  FOREIGN_DEPLOYMENT_GAS_PRICE: bigNumValidator(),
  GET_RECEIPT_INTERVAL_IN_MILLISECONDS: bigNumValidator(),
  HOME_RPC_URL: envalid.str(),
  HOME_OWNER_MULTISIG: addressValidator(),
  HOME_UPGRADEABLE_ADMIN_VALIDATORS: addressesValidator(),
  HOME_UPGRADEABLE_ADMIN_BRIDGE: addressValidator(),
  HOME_DAILY_LIMIT: bigNumValidator(),
  HOME_MAX_AMOUNT_PER_TX: bigNumValidator(),
  HOME_MIN_AMOUNT_PER_TX: bigNumValidator(),
  HOME_REQUIRED_BLOCK_CONFIRMATIONS: envalid.num(),
  HOME_GAS_PRICE: bigNumValidator(),
  FOREIGN_RPC_URL: envalid.str(),
  FOREIGN_OWNER_MULTISIG: addressValidator(),
  FOREIGN_UPGRADEABLE_ADMIN_VALIDATORS: addressValidator(),
  FOREIGN_UPGRADEABLE_ADMIN_BRIDGE: addressValidator(),
  FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS: envalid.num(),
  FOREIGN_GAS_PRICE: bigNumValidator(),
  REQUIRED_NUMBER_OF_VALIDATORS: envalid.num(),
  VALIDATORS: addressesValidator()
}

if (BRIDGE_MODE === 'NATIVE_TO_ERC') {
  validations = {
    ...validations,
    BRIDGEABLE_TOKEN_NAME: envalid.str(),
    BRIDGEABLE_TOKEN_SYMBOL: envalid.str(),
    BRIDGEABLE_TOKEN_DECIMALS: envalid.num(),
    FOREIGN_DAILY_LIMIT: bigNumValidator(),
    FOREIGN_MAX_AMOUNT_PER_TX: bigNumValidator(),
    FOREIGN_MIN_AMOUNT_PER_TX: bigNumValidator()
  }
}
if (BRIDGE_MODE === 'ERC_TO_ERC') {
  validations = {
    ...validations,
    ERC20_TOKEN_ADDRESS: addressValidator(),
    BRIDGEABLE_TOKEN_NAME: envalid.str(),
    BRIDGEABLE_TOKEN_SYMBOL: envalid.str(),
    BRIDGEABLE_TOKEN_DECIMALS: envalid.num()
  }
}
if (BRIDGE_MODE === 'ERC_TO_NATIVE') {
  validations = {
    ...validations,
    ERC20_TOKEN_ADDRESS: addressValidator(),
    BLOCK_REWARD_ADDRESS: addressValidator({
      default: ZERO_ADDRESS
    })
  }
}
if(BRIDGE_MODE === 'ERC_TO_ERC_MULTIPLE') {
  validations = {
    ...validations,
    HOME_OWNER_FACTORY: addressValidator(),
    HOME_OWNER_MAPPER: addressValidator(),
    HOME_UPGRADEABLE_ADMIN_FACTORY: addressValidator(),
    HOME_UPGRADEABLE_ADMIN_MAPPER: addressValidator(),
    FOREIGN_OWNER_FACTORY: addressValidator(),
    FOREIGN_UPGRADEABLE_ADMIN_FACTORY: addressValidator()
  }
}

const env = envalid.cleanEnv(process.env, validations)

module.exports = env
