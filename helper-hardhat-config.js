const networkConfig = {
    31337: {
        name: "localhost",
        ethUsdPriceFeed: "0x9326BFA02ADD2366b30bacB125260Af641031331",
        callbackGasLimit: "500000", // 500,000 gas
    },
    // Price Feed Address, values can be obtained at https://docs.chain.link/docs/reference-contracts
    5: {
        name: "goerli",
        ethUsdPriceFeed: "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e",
        callbackGasLimit: "500000", // 500,000 gas
    },
}

const DECIMALS = "18"
const INITIAL_PRICE = "200000000000000000000"
const developmentChains = ["hardhat", "localhost"]
const frontEndContractsFile = "../../urbe-django/frontend/constants/networkMapping.json"
const frontEndAbiLocation = "../../urbe-django/frontend/constants/"

module.exports = {
    networkConfig,
    developmentChains,
    DECIMALS,
    INITIAL_PRICE,
    frontEndContractsFile,
    frontEndAbiLocation,
}
