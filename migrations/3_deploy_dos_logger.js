const DosAttackLogger = artifacts.require("DosAttackLogger");

module.exports = function(deployer) {
  deployer.deploy(DosAttackLogger);
};