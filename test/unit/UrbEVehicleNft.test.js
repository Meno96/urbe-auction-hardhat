const { expect, assert } = require("chai")
const { network, ethers, deployments } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("UrbE Vehicle Nft Unit Test", function () {
          let urbEVehicle, urbEVehicleContract

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              user = accounts[1]
              await deployments.fixture(["all"])
              urbEVehicleContract = await ethers.getContract("UrbEVehicleNft")
              urbEVehicle = urbEVehicleContract.connect(deployer)
          })

          describe("Constructor", () => {
              it("Initializes the NFT Correctly.", async () => {
                  const name = await urbEVehicle.name()
                  const symbol = await urbEVehicle.symbol()
                  const tokenCounter = await urbEVehicle.getTokenCounter()

                  assert.equal(name, "UrbE Vehicles NFT")
                  assert.equal(symbol, "URBE")
                  assert.equal(tokenCounter.toString(), "0")
              })
          })

          describe("updateMappingNft", () => {
              it("Update array", async () => {
                  await urbEVehicle.updateMappingNft("Uri", "Name")
                  const nfts = await urbEVehicle.getNftInfos()
                  assert.equal(nfts[0].uri.toString(), "Uri")
                  assert.equal(nfts[0].name.toString(), "Name")
              })
          })

          describe("Mint NFT", () => {
              beforeEach(async () => {
                  const tx = await urbEVehicle.mintNft(0)
                  await tx.wait(1)
              })
              it("Allows users to mint an NFT, and updates appropriately", async function () {
                  const tokenCounter = await urbEVehicle.getTokenCounter()

                  assert.equal(tokenCounter.toString(), "1")
              })
              it("Show the correct balance and owner of an NFT", async function () {
                  const deployerAddress = deployer.address
                  const deployerBalance = await urbEVehicle.balanceOf(deployerAddress)
                  const owner = await urbEVehicle.ownerOf("0")

                  assert.equal(deployerBalance.toString(), "1")
                  assert.equal(owner, deployerAddress)
              })
          })
      })
