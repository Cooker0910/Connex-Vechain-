const Web3 = require('web3');
const thor = require('web3-providers-connex')
const { Framework } = require('@vechain/connex-framework');
const { Driver, SimpleNet, SimpleWallet } = require('@vechain/connex-driver')

const BridgeEth = require('./BridgeEth.json');
const BridgeVe = require('./BridgeVe.json');
const { createConnection } = require('mongoose');

const web3Eth = new Web3('wss://rinkeby.infura.io/ws/v3/0e42c582d71b4ba5a8750f688fce07da');

const main = async() => {
  const net = new SimpleNet('https://testnet.veblocks.net/')
  const wallet = new SimpleWallet();
  wallet.import('094ff6c63dce4e11a1421911a1f94a7cf3e8e40d9fe88c24477feea3eb50b8cd');
  const driver = await Driver.connect(net, wallet);
  const connex = new Framework(driver)
  const provider = new thor.ConnexProvider({ connex: connex })
  const web3Ve = new Web3(provider);
  
  const { address: admin } = web3Ve.eth.accounts.wallet.add('094ff6c63dce4e11a1421911a1f94a7cf3e8e40d9fe88c24477feea3eb50b8cd');
  
  const bridgeEth = new web3Eth.eth.Contract(
    BridgeEth.abi,
    BridgeEth.networks['4'].address
  );
  const bridgeVe = new web3Ve.eth.Contract(
    BridgeVe.abi,
    BridgeVe.networks['5777'].address
  );

  bridgeEth.events.Transfer({
	  fromBlock: 10942355,
	  step: 0
  })
  .on('data', async event => {
    const { from, to, amount, date, nonce } = event.returnValues;
    
    const tx = await bridgeVe.methods.mint(to, amount, nonce);
    const [gasPrice, gasCost] = await Promise.all([
      web3Ve.eth.getGasPrice(),
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

    const receipt = await web3Ve.eth_sendTransaction(txData);
    console.log(`Transaction hash: ${receipt.transactionHash}`);
    console.log(`
      Processed transfer:
      - from ${from} 
      - to ${to} 
      - amount ${amount} tokens
      - date ${date}
    `);
  });
}


main()