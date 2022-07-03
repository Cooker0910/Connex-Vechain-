const Web3 = require('web3');
const mongoose = require('mongoose');
const thorify = require("thorify").thorify;
const cors = require('cors');
const express = require('express');

const BridgeEth = require('./BridgeEth.json');
const BridgeVe = require('./BridgeVe.json');
const {ETHVE} = require('./ETHVE.model');

require('dotenv').config();

const app = express();
app.use(cors());

mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
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
      ETHVE.find((err, result) => {
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

  for (; ;) {
    let latestNum = await web3Eth.eth.getBlockNumber();
    try {
      await new Promise(async (resolve, reject) => {
        if (latestNum <= latestBlocknumber + 1) {
          resolve();
        }
        try {

          console.log(latestBlocknumber, latestNum, 'block number')

          bridgeEth.getPastEvents('Transfer', {
            fromBlock: latestBlocknumber,
            toBlock: latestNum,
            step: 0
          }, function(error, events) { return; })
          .then(async(events) => {
            console.log(events.length)
            for(var i = 0; i < events.length; i ++) {
              const { from, to, amount, date, nonce } = events[i].returnValues;
              console.log(from, to, amount, nonce)
              const tx = await bridgeVe.methods.mint(to, amount, nonce);
              console.log('tx finished')
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

              const updateData = {
                blockID: latestNum,
              }
              try{
                const receipt = await web3_ve.eth.sendTransaction(txData);
                console.log(receipt, 'receipt')
                ETHVE.findByIdAndUpdate(id, updateData, {new: true}, function(err, res) {
                  if(err) console.log("error", err)
                  else console.log("successed!!!")
                })
                latestBlocknumber = latestNum
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
            }
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      })
    } catch (error) {
      console.log("Event Fetching error" + error);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 10 * 1000)
    })
  }
});

  // try{
  //   console.log(1)
  //   bridgeEth.events.Transfer({
  //     fromBlock: latestBlocknumber,
  //     step: 0
  //   })
  //   .on('data', async event => {
  //     console.log()
  //     const { from, to, amount, date, nonce } = event.returnValues;
  //     console.log(from, to, amount, nonce)
  //     const tx = await bridgeVe.methods.mint(to, amount, nonce);
  //     const [gasPrice, gasCost] = await Promise.all([
  //       web3_ve.eth.getGasPrice(),
  //       tx.estimateGas({from: admin}),
  //     ]);
    
  //     const data = tx.encodeABI();
      
  //     const txData = {
  //       from: admin,
  //       to: bridgeVe.options.address,
  //       data,
  //       gas: gasCost,
  //       gasPrice
  //     };
  
  //     const receipt = await web3_ve.eth.sendTransaction(txData);
  //     const updateData = {
  //       blockID: latestNum,
  //     }
  //     try{
  //       const receipt = await web3Eth.eth.sendTransaction(txData);
  //       Block.findByIdAndUpdate(id, updateData, {new: true}, function(err, res) {
  //         if(err) console.log("error", err)
  //         else console.log("successed!!!")
  //       })
  //       latestBlocknumber = latestNum
  //       console.log(`Transaction hash: ${receipt.transactionHash}`);
  //       console.log(`
  //         Processed transfer:
  //         - from ${from} 
  //         - to ${to} 
  //         - amount ${amount} tokens
  //         - date ${date}
  //       `);
  //     } catch(err) {
  //       console.log("error---", err)
  //     }
  //     console.log(`Transaction hash: ${receipt.transactionHash}`);
  //     console.log(`
  //       Processed transfer:
  //       - from ${from} 
  //       - to ${to} 
  //       - amount ${amount} tokens
  //       - date ${date}
  //     `);
  //   });
  // } catch(err) {
  //   console.log(err, 'here')
  // }
