const Web3 = require('web3');
const mongoose = require('mongoose');
const thorify = require("thorify").thorify;
const cors = require('cors');
const express = require('express');

const BridgeEth = require('./BridgeEth.json');
const BridgeVe = require('./BridgeVe.json');
const {Block} = require('./Block.model');

require('dotenv').config();

const app = express();
app.use(cors());

mongoose.connect(process.env.MONGODB_URL_1, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.once('open', () => {
  console.log("Connected to MongoDB")
})

const web3Eth = new Web3(process.env.INFURA_KEY);
const web3_ve = thorify(new Web3(), "https://testnet.veblocks.net/");
const { address: admin } = web3_ve.eth.accounts.wallet.add(process.env.PRIVATE_KEY_VE);

const bridgeEth = new web3Eth.eth.Contract(
  BridgeEth.abi,
  BridgeEth.networks['4'].address
);

const bridgeVe = new web3_ve.eth.Contract(
  BridgeVe.abi,
  BridgeVe.networks['5777'].address
);

let latestBlocknumber;
let id;

app.listen(process.env.PORT || 5000, async function () {
  const getHead = async () => {
    try {
      // Get latest event's blocknumber and block id from mongodb
      Block.find((err, result) => {
        if (err) console.log("error", err)
        else {
          Object.values(result).map(function(block) {
            console.log(block)
            latestBlocknumber = block.blockID
          })
        }
      })
    } catch (error) {
      console.error("GetHead Event Err: add event info", error);
    }
  }
  
  latestBlocknumber = await getHead();

  let temp = await web3Eth.eth.getBlockNumber();
  console.log(latestBlocknumber, temp, 'block number')

  try{
    console.log(1)
    bridgeEth.events.Transfer({
      fromBlock: latestBlocknumber,
      step: 0
    })
    .on('data', async event => {
      console.log()
      const { from, to, amount, date, nonce } = event.returnValues;
      console.log(from, to, amount, nonce)
      const tx = await bridgeVe.methods.mint(to, amount, nonce);
      const [gasPrice, gasCost] = await Promise.all([
        web3_ve.eth.getGasPrice(),
        tx.estimateGas({from: admin}),
      ]);
    
      const data = tx.encodeABI();
      
      const txData = {
        from: admin,
        to: bridgeVe.options.address,
        data,
        gas: gasCost,
        gasPrice
      };
  
      const receipt = await web3_ve.eth.sendTransaction(txData);
      const updateData = {
        blockID: temp,
      }
      try{
        const receipt = await web3Eth.eth.sendTransaction(txData);
        Block.findByIdAndUpdate(id, updateData, {new: true}, function(err, res) {
          if(err) console.log("error", err)
          else console.log("successed!!!")
        })
        latestBlocknumber = temp
        console.log(`Transaction hash: ${receipt.transactionHash}`);
        console.log(`
          Processed transfer:
          - from ${from} 
          - to ${to} 
          - amount ${amount} tokens
          - date ${date}
        `);
      } catch(err) {
        console.log("error---", err)
      }
      console.log(`Transaction hash: ${receipt.transactionHash}`);
      console.log(`
        Processed transfer:
        - from ${from} 
        - to ${to} 
        - amount ${amount} tokens
        - date ${date}
      `);
    });
  } catch(err) {
    console.log(err, 'here')
  }
})