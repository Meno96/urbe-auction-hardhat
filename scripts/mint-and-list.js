const { ethers, network } = require("hardhat")
const { moveBlocks } = require("../utils/move-blocks")

const PRICE = ethers.utils.parseEther("0.1")
const TIME = 60

async function mintAndList() {
    const urbEAuction = await ethers.getContract("UrbEAuction")
    const urbEVehicleNft = await ethers.getContract("UrbEVehicleNft")
    console.log("Minting NFT...")
    const mintTx = await urbEVehicleNft.mintNft(0)
    const mintTxReceipt = await mintTx.wait(1)
    const tokenId = mintTxReceipt.events[0].args.tokenId
    console.log("Approving NFT...")
    const approvalTx = await urbEVehicleNft.approve(urbEAuction.address, tokenId)
    await approvalTx.wait(1)
    console.log("Listing NFT...")
    const tx = await urbEAuction.listItem(urbEVehicleNft.address, tokenId, 0, TIME)
    await tx.wait(1)
    console.log("NFT Listed!")
    if (network.config.chainId == 31337) {
        await moveBlocks(1, (sleepAmout = 1000))
    }
}

mintAndList()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
