const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { findMethodABI } = require('./utils/utils')
const { mnemonic } = require('thor-devkit');

const { Framework } = require('@vechain/connex-framework');
const { Driver, SimpleNet, SimpleWallet } = require('@vechain/connex-driver')
const { abi } = require('thor-devkit')


const { ADDRESS, ABI} = require('./src/config');

require('dotenv').config();

const app = express();

app.use(cors());

mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.once('open', () => {
  console.log("Connected to MongoDB")
})

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



  const net = new SimpleNet('https://testnet.veblocks.net/')

  //MP Connex
  const wallet = new SimpleWallet();
  wallet.import(process.env.PRIVATE_KEY);
  const driver = await Driver.connect(net, wallet);
  const connex = new Framework(driver)
  const accForMP = connex.thor.account(ADDRESS)
  const findMethodABI = (abi, method) => abi[abi.findIndex(mthd => mthd.name === method)];
  const testMethod = accForMP.method(findMethodABI(ABI, "testABI"))

  const step = 20;

  const getHead = async () => {
    try {
      // Get latest event's blocknumber and block id from mongodb
      return
    } catch (error) {
      console.error("GetHead Event Err: add event info", error);
    }
  }



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

  let latestBlocknumber = await getHead();
  for (; ;) {
    const blk = connex.thor.block()
    let latestBlockNum;
    await blk.get().then(block => {
      latestBlockNum = block.number;
    })
    try {

      await new Promise(async (resolve, reject) => {
        if (latestBlockNum <= latestBlocknumber + 1) {
          resolve();
        }
        try {

          console.log("latestBlockNumber", latestBlocknumber);
          console.log("latestBlockNum", latestBlockNum);

          const Filter = connex.thor.filter('event', [{ "address": ADDRESS }]).range({ unit: "block", from: latestBlocknumber + 1, to: latestBlockNum });
          let Offset = 0;
          let events = [];
          const decoder = newEventsDecoder(ABI);
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
            if (events[i].event === "Tranfer") {
              //do something for Transfer Event
              testMethod.transact().comment('Transfer')
              .request().then(result => {
                console.log(result);
              })

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
