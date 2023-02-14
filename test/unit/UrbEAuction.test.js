const { expect, assert, use } = require("chai")
const { watchFile } = require("fs")
const { network, ethers, deployments } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("UrbE Vehicle Nft Unit Test", function () {
          let urbEVehicle, urbEVehicleContract, urbEAuction, urbEAuctionContract
          const TOKEN_ID = 0
          const PRICE = ethers.utils.parseEther("0.1")
          const TIME = 3600

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              user = accounts[1]
              user2 = accounts[2]
              await deployments.fixture(["all"])
              urbEVehicleContract = await ethers.getContract("UrbEVehicleNft")
              urbEVehicle = urbEVehicleContract.connect(deployer)
              urbEAuctionContract = await ethers.getContract("UrbEAuction")
              urbEAuction = urbEAuctionContract.connect(deployer)
              await urbEVehicle.mintNft(0)
              await urbEVehicle.approve(urbEAuctionContract.address, TOKEN_ID)
          })

          describe("listItem", () => {
              it("OnlyOwner", async () => {
                  urbEAuction = urbEAuctionContract.connect(user)
                  await expect(urbEAuction.listItem(urbEVehicleContract.address, TOKEN_ID, 0, TIME))
                      .to.be.reverted
              })
              it("Check if NFT is already listed", async () => {
                  urbEAuction.listItem(urbEVehicleContract.address, TOKEN_ID, 0, TIME)
                  await expect(
                      urbEAuction.listItem(urbEVehicleContract.address, TOKEN_ID, 0, TIME)
                  ).to.be.revertedWith("AlreadyListed")
              })
              it("Needs approval to list items", async () => {
                  await urbEVehicle.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      urbEAuction.listItem(urbEVehicleContract.address, TOKEN_ID, 0, TIME)
                  ).to.be.revertedWith("NotApproved")
              })
              it("Bidding Time must be above zero", async () => {
                  await expect(
                      urbEAuction.listItem(urbEVehicleContract.address, TOKEN_ID, 0, 0)
                  ).to.be.revertedWith("TimeMustBeAboveZero")
              })
              it("Emits an event after listing an item", async () => {
                  expect(
                      await urbEAuction.listItem(urbEVehicleContract.address, TOKEN_ID, PRICE, TIME)
                  ).to.emit("ItemListed")
              })
              it("Updates listing with seller and price", async () => {
                  await urbEAuction.listItem(urbEVehicle.address, TOKEN_ID, PRICE, TIME)
                  const blockNumber = await ethers.provider.getBlockNumber()
                  const block = await ethers.provider.getBlock(blockNumber)
                  listing = await urbEAuction.getListing(urbEVehicle.address, 0)
                  assert.equal(listing.price.toString(), PRICE)
                  assert.equal(listing.isListed.toString(), "true")
                  assert.equal(listing.endTime.toString(), (block.timestamp + TIME).toString())
              })
          })

          describe("cancelItem", () => {
              it("OnlyOwner", async () => {
                  urbEAuction = urbEAuctionContract.connect(user)
                  await expect(urbEAuction.cancelListing(urbEVehicleContract.address, TOKEN_ID)).to
                      .be.reverted
              })
              it("Check if NFT is not listed", async () => {
                  await expect(
                      urbEAuction.cancelListing(urbEVehicleContract.address, TOKEN_ID)
                  ).to.be.revertedWith("NotListed")
              })
              it("Emits event and removes listing", async () => {
                  await urbEAuction.listItem(urbEVehicle.address, TOKEN_ID, PRICE, TIME)
                  expect(await urbEAuction.cancelListing(urbEVehicle.address, TOKEN_ID)).to.emit(
                      "ItemCanceled"
                  )
                  await expect(
                      urbEAuction.cancelListing(urbEVehicle.address, TOKEN_ID)
                  ).to.be.revertedWith("NotListed")
              })
              it("Add proceeds to highest bidder", async () => {
                  await urbEAuction.listItem(urbEVehicle.address, TOKEN_ID, 0, TIME)
                  urbEAuction = urbEAuctionContract.connect(user)
                  await urbEAuction.placeBid(urbEVehicle.address, TOKEN_ID, { value: PRICE })
                  urbEAuction = urbEAuctionContract.connect(deployer)
                  await urbEAuction.cancelListing(urbEVehicle.address, TOKEN_ID)
                  highestBidder = await urbEAuction.getHighestBidder()
                  proceedsHighestBidder = await urbEAuction.getProceeds(highestBidder)
                  assert.equal(proceedsHighestBidder.toString(), PRICE.toString())
              })
          })

          describe("placeBid", () => {
              it("OnlyNotOwner", async () => {
                  await urbEAuction.listItem(urbEVehicle.address, TOKEN_ID, 0, TIME)
                  await expect(
                      urbEAuction.placeBid(urbEVehicle.address, TOKEN_ID, { value: PRICE })
                  ).to.be.revertedWith("OnlyNotOwner")
              })
              it("Check if NFT is not listed", async () => {
                  await expect(
                      urbEAuction.placeBid(urbEVehicle.address, TOKEN_ID, { value: PRICE })
                  ).to.be.revertedWith("NotListed")
              })
              it("Can not place a bid if the auction is closed", async () => {
                  await urbEAuction.listItem(urbEVehicle.address, TOKEN_ID, 0, 1)
                  urbEAuction = urbEAuctionContract.connect(user)
                  await ethers.provider.send("evm_increaseTime", [2])
                  await expect(
                      urbEAuction.placeBid(urbEVehicle.address, TOKEN_ID, { value: PRICE })
                  ).to.be.revertedWith("AuctionAlreadyEnded")
              })
              it("Bid must be above actual NFT's price", async () => {
                  await urbEAuction.listItem(urbEVehicle.address, TOKEN_ID, PRICE, TIME)
                  urbEAuction = urbEAuctionContract.connect(user)
                  await expect(
                      urbEAuction.placeBid(urbEVehicle.address, TOKEN_ID, { value: PRICE })
                  ).to.be.revertedWith("BidNotHighEnough")
              })
              it("Return proceeds to the previus highest bidder", async () => {
                  await urbEAuction.listItem(urbEVehicle.address, TOKEN_ID, PRICE, TIME)
                  urbEAuction = urbEAuctionContract.connect(user)
                  urbEAuction.placeBid(urbEVehicle.address, TOKEN_ID, {
                      value: ethers.utils.parseEther("0.3"),
                  })
                  highestBidder = await urbEAuction.getHighestBidder()
                  urbEAuction = urbEAuctionContract.connect(user2)
                  urbEAuction.placeBid(urbEVehicle.address, TOKEN_ID, {
                      value: ethers.utils.parseEther("0.5"),
                  })
                  previusBidderProceeds = await urbEAuction.getProceeds(user.address)
                  assert.equal(
                      previusBidderProceeds.toString(),
                      ethers.utils.parseEther("0.3").toString()
                  )
              })
              it("Emits event, set highest bidder and update price", async () => {
                  await urbEAuction.listItem(urbEVehicle.address, TOKEN_ID, 0, TIME)
                  urbEAuction = urbEAuctionContract.connect(user)
                  expect(
                      await urbEAuction.placeBid(urbEVehicle.address, TOKEN_ID, { value: PRICE })
                  ).to.emit("HighestBidIncreased")
                  highestBidder = await urbEAuction.getHighestBidder()
                  assert.equal(highestBidder.toString(), user.address.toString())
                  listing = await urbEAuction.getListing(urbEVehicle.address, TOKEN_ID)
                  assert.equal(listing.price.toString(), PRICE)
              })
          })

          describe("auctionEnd", () => {
              it("Check if NFT is not listed", async () => {
                  await expect(
                      urbEAuction.auctionEnd(urbEVehicle.address, TOKEN_ID)
                  ).to.be.revertedWith("NotListed")
              })

              it("Revert if Auction Not Yet Ended", async () => {
                  await urbEAuction.listItem(urbEVehicle.address, TOKEN_ID, 0, TIME)
                  await expect(
                      urbEAuction.auctionEnd(urbEVehicle.address, TOKEN_ID)
                  ).to.be.revertedWith("AuctionNotYetEnded")
              })
              it("Updates internal proceeds record and delete listing", async () => {
                  await urbEAuction.listItem(urbEVehicle.address, TOKEN_ID, 0, 1)
                  urbEAuction = urbEAuctionContract.connect(user)
                  await urbEAuction.placeBid(urbEVehicle.address, TOKEN_ID, { value: PRICE })
                  await ethers.provider.send("evm_increaseTime", [2])
                  await urbEAuction.auctionEnd(urbEVehicle.address, TOKEN_ID)
                  proceedsDeployer = await urbEAuction.getProceeds(deployer.address)
                  assert.equal(proceedsDeployer.toString(), PRICE.toString())
                  urbEAuction = urbEAuctionContract.connect(deployer)
                  await expect(
                      urbEAuction.cancelListing(urbEVehicleContract.address, TOKEN_ID)
                  ).to.be.revertedWith("NotListed")
              })
              it("Transfers the nft to the buyer and emit event", async () => {
                  await urbEAuction.listItem(urbEVehicle.address, TOKEN_ID, 0, 1)
                  urbEAuction = urbEAuctionContract.connect(user)
                  await urbEAuction.placeBid(urbEVehicle.address, TOKEN_ID, { value: PRICE })
                  await ethers.provider.send("evm_increaseTime", [2])
                  expect(await urbEAuction.auctionEnd(urbEVehicle.address, TOKEN_ID)).to.emit(
                      "AuctionEnded"
                  )
                  const newOwner = await urbEVehicle.ownerOf(TOKEN_ID)
                  assert(newOwner.toString() == user.address)
              })
          })
          describe("withdrawProceeds", function () {
              it("Doesn't allow 0 proceed withdrawls", async () => {
                  await expect(urbEAuction.withdrawProceeds()).to.be.revertedWith("NoProceeds")
              })

              it("Withdraws proceeds", async () => {
                  await urbEAuction.listItem(urbEVehicle.address, TOKEN_ID, 0, 1)
                  urbEAuction = urbEAuctionContract.connect(user)
                  await urbEAuction.placeBid(urbEVehicle.address, TOKEN_ID, { value: PRICE })
                  urbEAuction = urbEAuctionContract.connect(deployer)
                  await ethers.provider.send("evm_increaseTime", [2])
                  await urbEAuction.auctionEnd(urbEVehicle.address, TOKEN_ID)

                  const deployerProceedsBefore = await urbEAuction.getProceeds(deployer.address)
                  const deployerBalanceBefore = await deployer.getBalance()
                  const txResponse = await urbEAuction.withdrawProceeds()
                  const transactionReceipt = await txResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const deployerBalanceAfter = await deployer.getBalance()

                  assert(
                      deployerBalanceAfter.add(gasCost).toString() ==
                          deployerProceedsBefore.add(deployerBalanceBefore).toString()
                  )
              })
          })
      })
