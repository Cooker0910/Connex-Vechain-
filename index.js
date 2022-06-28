const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { cry, mnemonic } = require('thor-devkit');

const { Framework } = require('@vechain/connex-framework');
const { Driver, SimpleNet, SimpleWallet } = require('@vechain/connex-driver')
const { abi } = require('thor-devkit')
const contractABI = require('./abi.json')
const ADDRESS = "0x691767D45623bF22A0707eE40d90c59837d82857"

require('dotenv').config();

const app = express();

app.use(cors());

// mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
// const db = mongoose.connection;
// db.once('open', () => {
//   console.log("Connected to MongoDB")
// })

app.listen(process.env.PORT || 5000, async function () {

  console.log('now listening for requests on port 5000');
  // const words = process.env.MNEMONIC;
  // const wordArray = words.split(" ");
  // const privateKeyForNFT = mnemonic.derivePrivateKey(wordArray);
  // console.log("prinvatekey", privateKeyForNFT);

  const net = new SimpleNet('https://mainnet.veblocks.net/')
  const wallet = new SimpleWallet();
  wallet.import(process.env.PRIVATE_KEY);
  const driver = await Driver.connect(net, wallet);
  const connex = new Framework(driver)
  const accForMP = connex.thor.account(ADDRESS)
  const findMethodABI = (abi, method) => abi[abi.findIndex(mthd => mthd.name === method)];
  
  console.log(accForMP)
  const testMethod = accForMP.method(findMethodABI(contractABI, "testABI"))
  console.log(testMethod)


});
