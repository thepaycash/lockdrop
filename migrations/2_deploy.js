var COLToken = artifacts.require("COLToken");
const dotenv = require('dotenv');
dotenv.config({path: "../.env"});

let teamMultisigAddress = process.env.TEAM_MULTISIG;
let stakingMultisigAddress = process.env.STAKING_MULTISIG;

module.exports = function(deployer) {
	if (deployer.network != 'test') {
    	deployer.deploy(COLToken, teamMultisigAddress, stakingMultisigAddress);
	}
}