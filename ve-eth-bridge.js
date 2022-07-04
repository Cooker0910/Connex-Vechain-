const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Web3 = require('web3');
const { Framework } = require('@vechain/connex-framework');
const { Driver, SimpleNet, SimpleWallet } = require('@vechain/connex-driver')
const { abi } = require('thor-devkit')

require('dotenv').config();
const {Block} = require('./Block.model');
const {contractABI} = require('./abi')
const BridgeEth = require('./BridgeEth.json');
const web3Eth = new Web3(process.env.INFURA_KEY);
const adminPrivKey = process.env.PRIVATE_KEY;
const bridgeVeAddr = process.env.Bridge_Ve_Addr;
const { address: admin } = web3Eth.eth.accounts.wallet.add(adminPrivKey);

const app = express();
app.use(cors());

const bridgeEth = new web3Eth.eth.Contract(
  BridgeEth.abi,
  BridgeEth.networks['4'].address
);

mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.once('open', () => {
  console.log("Connected to MongoDB")
})

let latestBlocknumber;
let id;

app.listen(process.env.PORT || 5000, async function () {

  // var Wallet = require('ethereumjs-wallet').default;
  // var key = Buffer.from('029e1f85161d6b6bcf4c923c718d4bb27f59a9d612bfd8f2b58c4fcb89c395cc', 'hex');
  // var wallet = await Wallet.fromPrivateKey(key);
  // const keystore = await wallet.toV3String('password')
  // console.log(keystore)


  // console.log('now listening for requests on port 5000');
  // const words = process.env.MNEMONIC_1;
  // const wordArray = words.split(" ");
  // const privateKeyForNFT = mnemonic.derivePrivateKey(wordArray);
  // console.log("prinvatekey", privateKeyForNFT);

  const net = new SimpleNet('https://testnet.veblocks.net/')
  const wallet = new SimpleWallet();
  wallet.import(process.env.PRIVATE_KEY);
  const driver = await Driver.connect(net, wallet);
  const connex = new Framework(driver)
  // const accForMP = connex.thor.account(ADDRESS)
  // const findMethodABI = (abi, method) => abi[abi.findIndex(mthd => mthd.name === method)];
  // const testMethod = accForMP.method(findMethodABI(contractABI, "mint"))

  const step = 20;

  const newEventsDecoder = (abiDefs) => {
    const coders = {}

    for (const def of abiDefs) {
      if (def.type === 'event') {
        const ev = new abi.Event(def)
        coders[ev.signature] = ev
      }
    }

    return {
      decode: (output) => {
        const ev = coders[output.topics[0]]
        if (!!ev) {
          output.decoded = ev.decode(output.data, output.topics)
          output.event = ev.definition.name
        }

        return output
      }
    }

  }

  const getHead = async () => {
    try {
      // Get latest event's blocknumber and block id from mongodb
      Block.find((err, result) => {
        if (err) console.log("error", err)
        else {
          Object.values(result).map(function(block) {
            console.log(block)
            latestBlocknumber = block.blockID
            id = block._id
            console.log(id, typeof(id), 'id')
          })
        }
      })
    } catch (error) {
      console.error("GetHead Event Err: add event info", error);
    }
  }

  latestBlocknumber = await getHead();

  for (; ;) {
    const blk = connex.thor.block()
    let latestBlock = await blk.get();
    let latestBlockNum = latestBlock.number;
    try {
      await new Promise(async (resolve, reject) => {
        if (latestBlockNum <= latestBlocknumber + 1) {
          resolve();
        }
        try {

          console.log("latestBlockInfo", latestBlocknumber, latestBlockNum);

          const Filter = connex
                        .thor
                        .filter('event', [{ "address": bridgeVeAddr }])
                        .range({ unit: "block", from: latestBlocknumber + 1, to: latestBlockNum });
          let Offset = 0;
          let events = [];
          const decoder = newEventsDecoder(contractABI);
          for (; ;) {
            const newOutput = await Filter.apply(Offset, step).then(outputs => outputs.map(x => decoder.decode(x)));
            events = [...events, ...newOutput];
            if (newOutput.length == 0) {
              break;
            }
            Offset += step
          }

          
          for (let i = 0; i < events.length; i++) {
            console.log("New Event: ", events[i].event)
            if (events[i].event === "Transfer") {
              if(events[i].decoded.step == 0){
                const { from, to, amount, date, nonce } = events[i].decoded;
                console.log(to, amount, nonce)
                //do something for Transfer Event
                const tx = bridgeEth.methods.mint(to, amount, nonce);
                const [gasPrice, gasCost] = await Promise.all([
                  web3Eth.eth.getGasPrice(),
                  tx.estimateGas({from: admin}),
                ]);
                const data = tx.encodeABI();
                console.log(data, 'data')
                const txData = {
                  from: admin,
                  to: bridgeEth.options.address,
                  data,
                  gas: gasCost,
                  gasPrice
                };
                const updateData = {
                  blockID: latestBlockNum,
                }
                try{
                  const receipt = await web3Eth.eth.sendTransaction(txData);
                  Block.findByIdAndUpdate(id, updateData, {new: true}, function(err, res) {
                    if(err) console.log("error", err)
                    else console.log("successed!!!")
                  })
                  latestBlocknumber = latestBlockNum
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

            }
          }
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