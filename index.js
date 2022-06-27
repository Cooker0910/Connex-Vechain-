const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { mnemonic } = require('thor-devkit');

const { Framework } = require('@vechain/connex-framework');
const { Driver, SimpleNet, SimpleWallet } = require('@vechain/connex-driver')
const { abi } = require('thor-devkit')



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
  /* Get Private Key
    // const words = process.env.Words;
    // const wordArray = words.split(" ");
    // console.log("words", wordArray);
    // const privateKeyForNFT = mnemonic.derivePrivateKey(wordArray);
    // console.log("prinvatekye", privateKeyForNFT);
    // console.log("privateKey", privateKey);
  */



  const net = new SimpleNet('https://mainnet.veblocks.net/')
  const driver = await Driver.connect(net)
  //MP Connex
  const connex = new Framework(driver)
  console.log(connex)


});
