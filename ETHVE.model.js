const mongoose = require("mongoose")

const EthVeSchema = new mongoose.Schema({
  blockID: {
    type: Number,
    require: true
  },
  blockNumber: {
    type: Number,
    require: true
  }
})

const ETHVE = mongoose.model('ETHVE', EthVeSchema);

module.exports = {ETHVE}