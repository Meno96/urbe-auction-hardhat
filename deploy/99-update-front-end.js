const { frontEndContractsFile, frontEndAbiLocation } = require("../helper-hardhat-config")
require("dotenv").config()
const fs = require("fs")
const { network } = require("hardhat")

module.exports = async () => {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Writing to front end...")
        await updateContractAddresses()
        await updateAbi()
        console.log("Front end written!")
    }
}

async function updateAbi() {
    const urbEAuction = await ethers.getContract("UrbEAuction")
    fs.writeFileSync(
        `${frontEndAbiLocation}UrbEAuction.json`,
        urbEAuction.interface.format(ethers.utils.FormatTypes.json)
    )

    const urbEVehicleNft = await ethers.getContract("UrbEVehicleNft")
    fs.writeFileSync(
        `${frontEndAbiLocation}UrbEVehicleNft.json`,
        urbEVehicleNft.interface.format(ethers.utils.FormatTypes.json)
    )
}

async function updateContractAddresses() {
    const chainId = network.config.chainId.toString()
    const urbEAuction = await ethers.getContract("UrbEAuction")
    const contractAddresses = JSON.parse(fs.readFileSync(frontEndContractsFile, "utf8"))
    if (chainId in contractAddresses) {
        if (!contractAddresses[chainId]["UrbEAuction"].includes(urbEAuction.address)) {
            contractAddresses[chainId]["UrbEAuction"].push(urbEAuction.address)
        }
    } else {
        contractAddresses[chainId] = { UrbEAuction: [urbEAuction.address] }
    }
    fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddresses))
}

module.exports.tags = ["all", "frontend"]
