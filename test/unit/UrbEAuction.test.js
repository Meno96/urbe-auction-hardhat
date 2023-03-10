const { expect, assert, use } = require("chai")
const { watchFile } = require("fs")
const { network, ethers, deployments } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("UrbE Auction Nft Unit Test", function () {
          let urbEVehicleNft, urbEVehicleNftContract, urbEAuction, urbEAuctionContract
          const TOKEN_ID = 0
          const PRICE = ethers.utils.parseEther("0.1")
          const TIME = 3600

          const auctionData = {
              title: "Test auction",
          }

          const auctionJson = JSON.stringify(auctionData)

          const auctionBytes = new TextEncoder().encode(auctionJson)

          const auctionHexString = []
          auctionBytes.forEach((byte) => {
              auctionHexString.push(("0" + byte.toString(16)).slice(-2))
          })

          const auctionString = "0x" + auctionHexString.join("")

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              user = accounts[1]
              user2 = accounts[2]
              await deployments.fixture(["all"])
              urbEVehicleNftContract = await ethers.getContract("UrbEVehicleNft")
              urbEVehicleNft = urbEVehicleNftContract.connect(deployer)
              urbEAuctionContract = await ethers.getContract("UrbEAuction")
              urbEAuction = urbEAuctionContract.connect(deployer)
              await urbEVehicleNft.mintNft(0)
              await urbEVehicleNft.approve(urbEAuctionContract.address, TOKEN_ID)
          })

          describe("listItem", () => {
              it("Check if NFT is already listed", async () => {
                  urbEAuction.listItem(urbEVehicleNftContract.address, TOKEN_ID, 0, TIME)
                  await expect(
                      urbEAuction.listItem(urbEVehicleNftContract.address, TOKEN_ID, 0, TIME)
                  ).to.be.revertedWith("AlreadyListed")
              })
              it("Needs approval to list items", async () => {
                  await urbEVehicleNft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      urbEAuction.listItem(urbEVehicleNftContract.address, TOKEN_ID, 0, TIME)
                  ).to.be.revertedWith("NotApproved")
              })
              it("Bidding Time must be above zero", async () => {
                  await expect(
                      urbEAuction.listItem(urbEVehicleNftContract.address, TOKEN_ID, 0, 0)
                  ).to.be.revertedWith("TimeMustBeAboveZero")
              })
              it("Emits an event after listing an item", async () => {
                  expect(
                      await urbEAuction.listItem(
                          urbEVehicleNftContract.address,
                          TOKEN_ID,
                          PRICE,
                          TIME
                      )
                  ).to.emit("ItemListed")
              })
              it("Updates listing with seller and price", async () => {
                  await urbEAuction.listItem(urbEVehicleNft.address, TOKEN_ID, PRICE, TIME)
                  const blockNumber = await ethers.provider.getBlockNumber()
                  const block = await ethers.provider.getBlock(blockNumber)
                  listing = await urbEAuction.getListing(urbEVehicleNft.address, 0)
                  assert.equal(listing.price.toString(), PRICE)
                  assert.equal(listing.isListed.toString(), "true")
                  assert.equal(listing.endTime.toString(), (block.timestamp + TIME).toString())
              })
          })

          describe("cancelItem", () => {
              it("OnlyOwner", async () => {
                  urbEAuction = urbEAuctionContract.connect(user)
                  await expect(urbEAuction.cancelListing(urbEVehicleNftContract.address, TOKEN_ID))
                      .to.be.reverted
              })
              it("Check if NFT is not listed", async () => {
                  await expect(
                      urbEAuction.cancelListing(urbEVehicleNftContract.address, TOKEN_ID)
                  ).to.be.revertedWith("NotListed")
              })
              it("Emits event and removes listing", async () => {
                  await urbEAuction.listItem(urbEVehicleNft.address, TOKEN_ID, PRICE, TIME)
                  expect(await urbEAuction.cancelListing(urbEVehicleNft.address, TOKEN_ID)).to.emit(
                      "ItemCanceled"
                  )
                  await expect(
                      urbEAuction.cancelListing(urbEVehicleNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NotListed")
              })
              it("Add proceeds to highest bidder", async () => {
                  await urbEAuction.listItem(urbEVehicleNft.address, TOKEN_ID, 0, TIME)
                  urbEAuction = urbEAuctionContract.connect(user)
                  await urbEAuction.placeBid(urbEVehicleNft.address, TOKEN_ID, { value: PRICE })
                  urbEAuction = urbEAuctionContract.connect(deployer)
                  listedItem = await urbEAuction.getListing(urbEVehicleNft.address, TOKEN_ID)
                  highestBidder = listedItem.highestBidder
                  await urbEAuction.cancelListing(urbEVehicleNft.address, TOKEN_ID)
                  proceedsHighestBidder = await urbEAuction.getProceeds(highestBidder)
                  assert.equal(proceedsHighestBidder.toString(), PRICE.toString())
              })
          })

          describe("placeBid", () => {
              it("OnlyNotOwner", async () => {
                  await urbEAuction.listItem(urbEVehicleNft.address, TOKEN_ID, 0, TIME)
                  await expect(
                      urbEAuction.placeBid(urbEVehicleNft.address, TOKEN_ID, { value: PRICE })
                  ).to.be.revertedWith("OnlyNotOwner")
              })
              it("Check if NFT is not listed", async () => {
                  await expect(
                      urbEAuction.placeBid(urbEVehicleNft.address, TOKEN_ID, { value: PRICE })
                  ).to.be.revertedWith("NotListed")
              })
              it("Can not place a bid if the auction is closed", async () => {
                  await urbEAuction.listItem(urbEVehicleNft.address, TOKEN_ID, 0, 1)
                  urbEAuction = urbEAuctionContract.connect(user)
                  await ethers.provider.send("evm_increaseTime", [2])
                  await expect(
                      urbEAuction.placeBid(urbEVehicleNft.address, TOKEN_ID, { value: PRICE })
                  ).to.be.revertedWith("AuctionAlreadyEnded")
              })
              it("Bid must be above actual NFT's price", async () => {
                  await urbEAuction.listItem(urbEVehicleNft.address, TOKEN_ID, PRICE, TIME)
                  urbEAuction = urbEAuctionContract.connect(user)
                  await expect(
                      urbEAuction.placeBid(urbEVehicleNft.address, TOKEN_ID, { value: PRICE })
                  ).to.be.revertedWith("BidNotHighEnough")
              })
              it("Return proceeds to the previus highest bidder", async () => {
                  await urbEAuction.listItem(urbEVehicleNft.address, TOKEN_ID, PRICE, TIME)
                  urbEAuction = urbEAuctionContract.connect(user)
                  urbEAuction.placeBid(urbEVehicleNft.address, TOKEN_ID, {
                      value: ethers.utils.parseEther("0.3"),
                  })
                  urbEAuction = urbEAuctionContract.connect(user2)
                  urbEAuction.placeBid(urbEVehicleNft.address, TOKEN_ID, {
                      value: ethers.utils.parseEther("0.5"),
                  })
                  previusBidderProceeds = await urbEAuction.getProceeds(user.address)
                  assert.equal(
                      previusBidderProceeds.toString(),
                      ethers.utils.parseEther("0.3").toString()
                  )
              })
              it("Emits event, set highest bidder and update price", async () => {
                  await urbEAuction.listItem(urbEVehicleNft.address, TOKEN_ID, 0, TIME)
                  urbEAuction = urbEAuctionContract.connect(user)
                  expect(
                      await urbEAuction.placeBid(urbEVehicleNft.address, TOKEN_ID, { value: PRICE })
                  ).to.emit("HighestBidIncreased")
                  listedItem = await urbEAuction.getListing(urbEVehicleNft.address, TOKEN_ID)
                  highestBidder = listedItem.highestBidder
                  assert.equal(highestBidder.toString(), user.address.toString())
                  listing = await urbEAuction.getListing(urbEVehicleNft.address, TOKEN_ID)
                  assert.equal(listing.price.toString(), PRICE)
              })
          })

          describe("auctionEnd", () => {
              it("Check if NFT is not listed", async () => {
                  await expect(
                      urbEAuction.auctionEnd(urbEVehicleNft.address, TOKEN_ID, auctionString)
                  ).to.be.revertedWith("NotListed")
              })

              it("Revert if Auction Not Yet Ended", async () => {
                  await urbEAuction.listItem(urbEVehicleNft.address, TOKEN_ID, 0, TIME)
                  await expect(
                      urbEAuction.auctionEnd(urbEVehicleNft.address, TOKEN_ID, auctionString)
                  ).to.be.revertedWith("AuctionNotYetEnded")
              })
              it("Updates internal proceeds record and delete listing", async () => {
                  await urbEAuction.listItem(urbEVehicleNft.address, TOKEN_ID, 0, 1)
                  urbEAuction = urbEAuctionContract.connect(user)
                  await urbEAuction.placeBid(urbEVehicleNft.address, TOKEN_ID, { value: PRICE })
                  await ethers.provider.send("evm_increaseTime", [2])
                  await urbEAuction.auctionEnd(urbEVehicleNft.address, TOKEN_ID, auctionString)
                  proceedsDeployer = await urbEAuction.getProceeds(deployer.address)
                  assert.equal(proceedsDeployer.toString(), PRICE.toString())
                  urbEAuction = urbEAuctionContract.connect(deployer)
                  await expect(
                      urbEAuction.cancelListing(urbEVehicleNftContract.address, TOKEN_ID)
                  ).to.be.revertedWith("NotListed")
              })
              it("Transfers the nft to the buyer and emit event", async () => {
                  await urbEAuction.listItem(urbEVehicleNft.address, TOKEN_ID, 0, 1)
                  urbEAuction = urbEAuctionContract.connect(user)
                  await urbEAuction.placeBid(urbEVehicleNft.address, TOKEN_ID, { value: PRICE })
                  await ethers.provider.send("evm_increaseTime", [2])
                  expect(
                      await urbEAuction.auctionEnd(urbEVehicleNft.address, TOKEN_ID, auctionString)
                  ).to.emit("AuctionEnded")
                  const newOwner = await urbEVehicleNft.ownerOf(TOKEN_ID)
                  assert(newOwner.toString() == user.address)
              })
              it("Cancel Item if there's no bid", async () => {
                  await urbEAuction.listItem(urbEVehicleNft.address, TOKEN_ID, 0, 1)
                  await ethers.provider.send("evm_increaseTime", [2])
                  await urbEAuction.auctionEnd(urbEVehicleNft.address, TOKEN_ID, auctionString)
                  await expect(
                      urbEAuction.cancelListing(urbEVehicleNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NotListed")
              })
          })
          describe("withdrawProceeds", function () {
              it("Doesn't allow 0 proceed withdrawls", async () => {
                  await expect(urbEAuction.withdrawProceeds()).to.be.revertedWith("NoProceeds")
              })

              it("Withdraws proceeds", async () => {
                  await urbEAuction.listItem(urbEVehicleNft.address, TOKEN_ID, 0, 1)
                  urbEAuction = urbEAuctionContract.connect(user)
                  await urbEAuction.placeBid(urbEVehicleNft.address, TOKEN_ID, { value: PRICE })
                  urbEAuction = urbEAuctionContract.connect(deployer)
                  await ethers.provider.send("evm_increaseTime", [2])
                  await urbEAuction.auctionEnd(urbEVehicleNft.address, TOKEN_ID, auctionString)

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
          describe("getDeployer", function () {
              it("getDeployer", async () => {
                  assert.equal(await urbEAuction.getDeployer(), deployer.address)
              })
          })
      })
